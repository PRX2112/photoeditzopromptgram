import { prisma, checkDatabaseConnection } from "@/lib/prisma";
import { vercelBlobService } from "./vercel-blob";
import { dbService } from "@/lib/db-service";
import type { PostItem } from "@/types";

export interface CleanupResult {
  success: boolean;
  postId: string;
  blobUrl?: string | null;
  message?: string;
  error?: string;
}

export const cleanupService = {
  /**
   * Execute cleanup of a temporary Blob image for a confirmed published post
   */
  cleanupPostImage: async (postId: string, postRecord?: Partial<PostItem>): Promise<CleanupResult> => {
    const dbCheck = await checkDatabaseConnection();

    if (dbCheck.ok) {
      // 1. Fetch Post record and verify eligibility
      const post = postRecord || (await prisma.post.findUnique({
        where: { id: postId },
      }));

      if (!post) {
        return { success: false, postId, error: `Post ${postId} not found` };
      }

      // CRITICAL ELIGIBILITY CHECKS
      if (post.status !== "PUBLISHED") {
        return {
          success: false,
          postId,
          error: `Post is in state '${post.status}'. Cannot clean up image unless confirmed PUBLISHED.`,
        };
      }

      if (!post.instagramMediaId || !post.publishedAt) {
        return {
          success: false,
          postId,
          error: "Instagram Media ID and published timestamp must be persisted before image cleanup.",
        };
      }

      // If already deleted
      if (post.imageLifecycleStatus === "DELETED" || (!post.blobUrl && !post.temporaryImageUrl)) {
        return {
          success: true,
          postId,
          message: "Image already deleted or cleared.",
        };
      }

      const targetUrl = post.blobUrl || post.temporaryImageUrl;
      if (!targetUrl) {
        await prisma.post.update({
          where: { id: postId },
          data: {
            imageLifecycleStatus: "DELETED",
            imageDeletedAt: new Date(),
          },
        });
        return { success: true, postId, message: "No Blob URL to delete; marked DELETED." };
      }

      // 2. Perform deletion from Vercel Blob
      try {
        const deleteRes = await vercelBlobService.deleteTemporaryImage(targetUrl);

        if (!deleteRes.success) {
          throw new Error(deleteRes.error || "Blob deletion failed");
        }

        // 3. Record successful cleanup in database transaction
        await prisma.post.update({
          where: { id: postId },
          data: {
            imageLifecycleStatus: "DELETED",
            imageDeletedAt: new Date(),
            blobUrl: null, // Clear URL
            blobPathname: null,
            temporaryImageUrl: null,
            lastCleanupError: null,
          },
        });

        return {
          success: true,
          postId,
          blobUrl: targetUrl,
          message: "Temporary Blob image successfully deleted.",
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const nextAttempts = (post.cleanupAttempts || 0) + 1;

        // Mark as CLEANUP_FAILED without touching publication status
        await prisma.post.update({
          where: { id: postId },
          data: {
            imageLifecycleStatus: "CLEANUP_FAILED",
            cleanupAttempts: nextAttempts,
            lastCleanupError: errorMsg,
          },
        });

        return {
          success: false,
          postId,
          error: errorMsg,
        };
      }
    }

    // In-memory fallback
    const post = await dbService.getPosts();
    const target = post.find((p) => p.id === postId);

    if (target && target.status === "PUBLISHED") {
      await dbService.updatePost(postId, {
        imageLifecycleStatus: "DELETED",
        imageDeletedAt: new Date().toISOString(),
        blobUrl: null,
        temporaryImageUrl: null,
      });
      return { success: true, postId, message: "Fallback cleanup succeeded" };
    }

    return { success: false, postId, error: "Post not eligible for cleanup" };
  },
};
