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
      // Collect all temporary Blob URLs to delete
      const urlsToDelete: string[] = [];
      if (post.renderedImageUrl) urlsToDelete.push(post.renderedImageUrl);
      if (post.blobUrl && !urlsToDelete.includes(post.blobUrl)) urlsToDelete.push(post.blobUrl);
      if (post.temporaryImageUrl && !urlsToDelete.includes(post.temporaryImageUrl)) urlsToDelete.push(post.temporaryImageUrl);

      // Also clean up prompt source image if post has prompt
      if (post.promptId) {
        const associatedPrompt = await prisma.prompt.findUnique({
          where: { id: post.promptId },
          select: { id: true, sourceImageUrl: true },
        });
        if (associatedPrompt?.sourceImageUrl && !urlsToDelete.includes(associatedPrompt.sourceImageUrl)) {
          urlsToDelete.push(associatedPrompt.sourceImageUrl);
        }
      }

      if (urlsToDelete.length === 0) {
        await prisma.post.update({
          where: { id: postId },
          data: {
            imageLifecycleStatus: "DELETED",
            renderedImageStatus: "DELETED",
            imageDeletedAt: new Date(),
          },
        });
        return { success: true, postId, message: "No Blob URLs to delete; marked DELETED." };
      }

      // 2. Perform deletion from Vercel Blob
      try {
        for (const url of urlsToDelete) {
          const deleteRes = await vercelBlobService.deleteTemporaryImage(url);
          if (!deleteRes.success && !deleteRes.error?.includes("already deleted")) {
            throw new Error(deleteRes.error || "Blob deletion failed");
          }
        }

        // 3. Record successful cleanup in database transaction
        await prisma.$transaction(async (tx) => {
          await tx.post.update({
            where: { id: postId },
            data: {
              imageLifecycleStatus: "DELETED",
              renderedImageStatus: "DELETED",
              imageDeletedAt: new Date(),
              blobUrl: null,
              blobPathname: null,
              renderedImageUrl: null,
              renderedBlobPathname: null,
              temporaryImageUrl: null,
              lastCleanupError: null,
            },
          });

          if (post.promptId) {
            await tx.prompt.update({
              where: { id: post.promptId },
              data: {
                sourceImageStatus: "DELETED",
                sourceImageDeletedAt: new Date(),
                sourceImageUrl: null,
                sourceBlobPathname: null,
              },
            });
          }
        });

        return {
          success: true,
          postId,
          blobUrl: urlsToDelete.join(", "),
          message: "All temporary Blob assets successfully purged.",
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
