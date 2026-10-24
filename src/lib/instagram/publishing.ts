import { prisma, checkDatabaseConnection } from "@/lib/prisma";
import { instagramService } from "@/lib/instagram";
import { queueService } from "@/lib/queue";
import { dbService } from "@/lib/db-service";
import { decryptToken } from "@/lib/crypto";
import { combineCaptionAndHashtags } from "@/lib/gemini";

export interface PublicationServiceResult {
  success: boolean;
  postId: string;
  mediaId?: string | null;
  permalink?: string | null;
  isAmbiguous?: boolean;
  error?: string;
}

export const instagramPublishingService = {
  /**
   * Publish post to Instagram with atomic claiming, container persistence, status polling, and transactional cleanup enqueuing
   */
  publishPost: async (postId: string, workerId: string = "web-worker"): Promise<PublicationServiceResult> => {
    const dbCheck = await checkDatabaseConnection();

    if (dbCheck.ok) {
      // 1. Atomically claim post: Must be DRAFT or SCHEDULED (not already PUBLISHED or PUBLISHING)
      const claimResult = await prisma.post.updateMany({
        where: {
          id: postId,
          status: { in: ["DRAFT", "SCHEDULED", "FAILED"] },
        },
        data: {
          status: "PUBLISHING",
          imageLifecycleStatus: "PUBLISHING",
          publicationAttempts: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        // Check if already published
        const currentPost = await prisma.post.findUnique({ where: { id: postId } });
        if (currentPost?.status === "PUBLISHED") {
          return {
            success: true,
            postId,
            mediaId: currentPost.instagramMediaId,
            permalink: currentPost.instagramPermalink,
          };
        }
        return {
          success: false,
          postId,
          error: "Post is already being published by another concurrent worker or not eligible.",
        };
      }

      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { prompt: true, instagramAccount: true },
      });

      if (!post) {
        return { success: false, postId, error: "Post not found" };
      }

      const imageUrl = post.renderedImageUrl || post.blobUrl || post.temporaryImageUrl;
      if (!imageUrl) {
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: "FAILED",
            imageLifecycleStatus: "UPLOADED",
            lastPublishError: "Missing image URL for publication",
          },
        });
        return { success: false, postId, error: "No image URL available for Instagram publication" };
      }

      const fullCaption = combineCaptionAndHashtags(post.caption, post.hashtags);

      // Check Meta Configuration
      if (!instagramService.isConfigured()) {
        // Mock publication for preview/development
        const mockMediaId = `1802${Date.now().toString().slice(-8)}`;
        const mockPermalink = `https://www.instagram.com/p/C${Math.random().toString(36).substring(2, 8)}/`;

        // Transactional commit: Update post to PUBLISHED + mark prompt isPublished + enqueue CLEANUP_BLOB job
        await prisma.$transaction(async (tx) => {
          await tx.post.update({
            where: { id: postId },
            data: {
              status: "PUBLISHED",
              imageLifecycleStatus: "CLEANUP_PENDING",
              instagramMediaId: mockMediaId,
              instagramPermalink: mockPermalink,
              publishedAt: new Date(),
              lastPublishError: null,
            },
          });

          if (post.promptId) {
            await tx.prompt.update({
              where: { id: post.promptId },
              data: {
                isPublished: true,
                publishedAt: new Date(),
              },
            });
          }

          await tx.scheduledJob.create({
            data: {
              jobType: "CLEANUP_BLOB",
              payload: JSON.stringify({ postId }),
              runAt: new Date(), // Immediate cleanup eligibility
              status: "PENDING",
            },
          });
        });

        return {
          success: true,
          postId,
          mediaId: mockMediaId,
          permalink: mockPermalink,
        };
      }

      // REAL META GRAPH API WORKFLOW
      try {
        const encryptedToken = post.instagramAccount?.accessTokenEncrypted || process.env.META_INSTAGRAM_ACCESS_TOKEN || "dummy_token";
        const igUserId = post.instagramAccount?.igUserId || process.env.META_INSTAGRAM_ACCOUNT_ID || "17841479958291582";
        const accessToken = encryptedToken.includes(":") ? decryptToken(encryptedToken) : encryptedToken;

        // Step 1: Create Container
        // If containerId already exists from a previous attempt, skip creation!
        let containerId = post.containerId;
        if (!containerId) {
          const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: imageUrl,
              caption: fullCaption,
              access_token: accessToken,
            }),
          });

          const containerData = await containerRes.json();
          if (!containerRes.ok || containerData.error) {
            throw new Error(`Media container creation failed: ${containerData.error?.message || "Unknown error"}`);
          }
          containerId = containerData.id;

          // Persist container ID immediately for recovery
          await prisma.post.update({
            where: { id: postId },
            data: { containerId },
          });
        }

        // Step 2: Poll Container Status
        let status: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" = "IN_PROGRESS";
        let attempts = 0;
        const maxPollAttempts = 10;

        while (status === "IN_PROGRESS" && attempts < maxPollAttempts) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const statusRes = await fetch(
            `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
          );
          const statusData = await statusRes.json();
          if (statusData.status_code) {
            status = statusData.status_code;
          } else if (statusRes.ok && !statusData.error) {
            // For single image containers on Meta Graph API, if status_code field is omitted or immediately finished
            status = "FINISHED";
          } else if (statusData.error) {
            throw new Error(`Media container processing error: ${statusData.error.message || "Unknown error"}`);
          }
        }

        if (status !== "FINISHED") {
          throw new Error(`Media container processing ended with status: ${status}`);
        }

        // Step 3: Publish Media
        const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: accessToken,
          }),
        });

        const publishData = await publishRes.json();
        if (!publishRes.ok || publishData.error) {
          throw new Error(`Publish execution failed: ${publishData.error?.message || "Unknown error"}`);
        }

        const mediaId = publishData.id;

        // Step 4: Retrieve permalink
        const detailsRes = await fetch(
          `https://graph.facebook.com/v21.0/${mediaId}?fields=permalink,timestamp&access_token=${accessToken}`
        );
        const detailsData = await detailsRes.json();
        const permalink = detailsData.permalink || `https://www.instagram.com/p/${mediaId}/`;

        // Step 5: Transactional Commit: Save confirmed publication & enqueue cleanup job
        await prisma.$transaction(async (tx) => {
          await tx.post.update({
            where: { id: postId },
            data: {
              status: "PUBLISHED",
              imageLifecycleStatus: "CLEANUP_PENDING",
              instagramMediaId: mediaId,
              instagramPermalink: permalink,
              publishedAt: new Date(),
              lastPublishError: null,
            },
          });

          if (post.promptId) {
            await tx.prompt.update({
              where: { id: post.promptId },
              data: {
                isPublished: true,
                publishedAt: new Date(),
              },
            });
          }

          await tx.scheduledJob.create({
            data: {
              jobType: "CLEANUP_BLOB",
              payload: JSON.stringify({ postId }),
              runAt: new Date(),
              status: "PENDING",
            },
          });
        });

        return {
          success: true,
          postId,
          mediaId,
          permalink,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Mark post as FAILED or mark for reconciliation if ambiguous
        const isAmbiguous = errorMsg.includes("timeout") || errorMsg.includes("network");

        await prisma.post.update({
          where: { id: postId },
          data: {
            status: isAmbiguous ? "PUBLISHING" : "FAILED",
            lastPublishError: errorMsg,
            reconciliationMetadata: JSON.stringify({
              workerId,
              error: errorMsg,
              timestamp: new Date().toISOString(),
              isAmbiguous,
            }),
          },
        });

        if (isAmbiguous) {
          // Enqueue reconciliation job instead of blind retry
          await queueService.scheduleJob("RECONCILE_PUBLICATION", { postId }, new Date(Date.now() + 60000));
        }

        return {
          success: false,
          postId,
          isAmbiguous,
          error: errorMsg,
        };
      }
    }

    // In-memory fallback
    const mockMediaId = `1802${Date.now().toString().slice(-8)}`;
    const mockPermalink = `https://www.instagram.com/p/C${Math.random().toString(36).substring(2, 8)}/`;

    await dbService.updatePost(postId, {
      status: "PUBLISHED",
      imageLifecycleStatus: "CLEANUP_PENDING",
      instagramMediaId: mockMediaId,
      instagramPermalink: mockPermalink,
      publishedAt: new Date().toISOString(),
    });

    await queueService.scheduleJob("CLEANUP_BLOB", { postId }, new Date());

    return {
      success: true,
      postId,
      mediaId: mockMediaId,
      permalink: mockPermalink,
    };
  },
};
