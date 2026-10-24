import crypto from "crypto";
import { prisma, checkDatabaseConnection } from "./prisma";
import { dbService } from "./db-service";
import { dmReservationService } from "./instagram/dm-reservation";
import type { InstagramWebhookPayload, PostItem, PromptItem } from "@/types";

export interface ProcessCommentResult {
  commentId: string;
  action: "DELIVERED" | "IGNORED" | "FAILED" | "DUPLICATE" | "SUPPRESSED";
  message?: string;
  slug?: string;
  reservationId?: string;
}

/**
 * Match comment text against expected keyword using word boundary tokenization
 */
export function matchesKeyword(commentText: string, expectedKeyword: string): boolean {
  if (!commentText || !expectedKeyword) return false;

  const normalizedComment = commentText.trim().toLowerCase();
  const normalizedExpected = expectedKeyword.trim().toLowerCase();

  // 1. Direct equality
  if (normalizedComment === normalizedExpected) return true;

  // 2. Word boundary regular expression
  const regex = new RegExp(`\\b${normalizedExpected}\\b`, "i");
  if (regex.test(normalizedComment)) return true;

  // 3. Simple token inclusion (strip punctuation)
  const cleaned = normalizedComment.replace(/[^\w\s]/gi, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.includes(normalizedExpected);
}

export const webhookProcessor = {
  /**
   * Process incoming Instagram webhook payload with durable ingestion and per-user/per-post DM idempotency
   */
  processWebhookEvent: async (
    payload: InstagramWebhookPayload,
    rawSignature?: string | null
  ): Promise<ProcessCommentResult[]> => {
    const results: ProcessCommentResult[] = [];
    const dbCheck = await checkDatabaseConnection();

    // Verify automation setting is globally enabled
    const settings = await dbService.getAutomationSettings();
    if (!settings.isAutomationEnabled) {
      return [{ commentId: "all", action: "IGNORED", message: "Automation globally disabled" }];
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== "comments") continue;

        const comment = change.value;
        const commentId = comment.id;
        const commentText = comment.text || "";
        const mediaId = comment.media?.id;
        const instagramScopedUserId = comment.from?.id; // Stable IGSID

        if (!commentId || !mediaId || !instagramScopedUserId) {
          results.push({
            commentId: commentId || "unknown",
            action: "IGNORED",
            message: "Missing commentId, mediaId, or commenter IGSID in webhook payload",
          });
          continue;
        }

        // 1. Durable Webhook Ingestion & Comment Deduplication
        if (dbCheck.ok) {
          try {
            await prisma.webhookEvent.create({
              data: {
                eventId: `evt_${commentId}`,
                eventType: "comment",
                commentId: commentId,
                rawPayload: JSON.stringify(change),
                signature: rawSignature || null,
                isProcessed: false,
              },
            });
          } catch (err: unknown) {
            // P2002: duplicate commentId or eventId
            if ((err as { code?: string })?.code === "P2002") {
              results.push({
                commentId,
                action: "DUPLICATE",
                message: `Duplicate webhook event for comment ${commentId}. Acknowledged without reprocessing.`,
              });
              continue;
            }
          }
        }

        // 2. Check 7-Day Meta Private Reply Window
        if (comment.created_time) {
          const commentDate = new Date(comment.created_time * 1000);
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000);
          if (commentDate < sevenDaysAgo) {
            results.push({
              commentId,
              action: "SUPPRESSED",
              message: "Comment is older than 7 days; outside Meta Private Reply window.",
            });
            continue;
          }
        }

        // 3. Resolve Post by Instagram Media ID
        let matchedPost: (PostItem & { prompt?: PromptItem }) | null = null;
        if (dbCheck.ok) {
          const dbPost = await prisma.post.findFirst({
            where: { instagramMediaId: mediaId },
            include: { prompt: true },
          });
          if (dbPost) {
            matchedPost = {
              ...dbPost,
              status: dbPost.status,
              createdAt: dbPost.createdAt.toISOString(),
              updatedAt: dbPost.updatedAt.toISOString(),
              scheduledFor: dbPost.scheduledFor?.toISOString() || null,
              publishedAt: dbPost.publishedAt?.toISOString() || null,
              imageUploadedAt: dbPost.imageUploadedAt?.toISOString() || null,
              imageDeletedAt: dbPost.imageDeletedAt?.toISOString() || null,
              prompt: dbPost.prompt
                ? {
                    ...dbPost.prompt,
                    tags: dbPost.prompt.tags.split(","),
                    generationSettings: dbPost.prompt.generationSettings
                      ? JSON.parse(dbPost.prompt.generationSettings)
                      : undefined,
                    createdAt: dbPost.prompt.createdAt.toISOString(),
                    updatedAt: dbPost.prompt.updatedAt.toISOString(),
                  }
                : undefined,
            };
          }
        } else {
          const allPosts = await dbService.getPosts();
          matchedPost = (allPosts.find((p) => p.instagramMediaId === mediaId) as (PostItem & { prompt?: PromptItem })) || null;
        }

        if (!matchedPost) {
          results.push({
            commentId,
            action: "IGNORED",
            message: `No published post found for media ID ${mediaId}.`,
          });
          continue;
        }

        // 4. Keyword matching (post-specific keyword takes precedence over global)
        const targetKeyword = matchedPost.commentKeyword || settings.globalKeyword || "PROMPT";
        const isMatched = matchesKeyword(commentText, targetKeyword);

        if (!isMatched) {
          results.push({
            commentId,
            action: "IGNORED",
            message: `Comment did not contain keyword '${targetKeyword}'.`,
          });
          continue;
        }

        // Check if comment was authored by the page/account itself
        const pageIgId = process.env.META_INSTAGRAM_ACCOUNT_ID || "17841479958291582";
        if (instagramScopedUserId === pageIgId) {
          results.push({
            commentId,
            action: "SUPPRESSED",
            message: `Comment was authored by post owner (@prx_dev). Meta Graph API prohibits sending automated private replies to the account's own comments. Test by commenting from a different Instagram account.`,
          });
          continue;
        }

        // 5. ATOMIC PER-USER/PER-POST RESERVATION
        // Enforce: At most ONE automated DM per unique Instagram user per published post
        const reservation = await dmReservationService.reserveDelivery({
          postId: matchedPost.id,
          instagramScopedUserId,
          commentId,
          commentText,
          commentTimestamp: comment.created_time ? new Date(comment.created_time * 1000) : new Date(),
          matchedPromptId: matchedPost.promptId,
          instagramAccountId: matchedPost.instagramAccountId,
        });

        if (reservation.isDuplicate) {
          results.push({
            commentId,
            action: "SUPPRESSED",
            reservationId: reservation.reservationId,
            message: `User ${instagramScopedUserId} already received or reserved a DM for post ${matchedPost.id}. Suppressed repeat comment.`,
          });
          continue;
        }

        // 6. Format Reply Text
        const promptSlug = matchedPost.prompt?.slug || "sample-prompt";
        const promptUrl = `${baseUrl}/p/${promptSlug}`;
        const replyText = settings.replyTemplate
          ? settings.replyTemplate
              .replace("{prompt_url}", promptUrl)
              .replace("{prompt_title}", matchedPost.prompt?.title || "")
              .replace("{category}", matchedPost.prompt?.category || "")
          : `Here is the photography prompt you requested: ${promptUrl}`;

        // 7. Execute Private Reply Delivery
        const deliveryResult = await dmReservationService.executeDelivery({
          reservationId: reservation.reservationId!,
          commentId,
          messageText: replyText,
          instagramAccountId: matchedPost.instagramAccountId,
        });

        // 8. Mark WebhookEvent as processed
        if (dbCheck.ok) {
          await prisma.webhookEvent.updateMany({
            where: { commentId },
            data: { isProcessed: true, processedAt: new Date() },
          });
        }

        results.push({
          commentId,
          action: deliveryResult.success ? "DELIVERED" : "FAILED",
          reservationId: reservation.reservationId,
          slug: promptSlug,
          message: deliveryResult.success
            ? `Private reply sent with prompt link: ${promptUrl}`
            : `Delivery failed: ${deliveryResult.error}`,
        });
      }
    }

    return results;
  },

  /**
   * Verify HMAC-SHA256 signature from Meta webhook request
   */
  verifySignature: (
    rawBody: string,
    signatureHeader?: string | null,
    secret?: string
  ): boolean => {
    const appSecret = secret || process.env.META_APP_SECRET;
    if (!signatureHeader || !appSecret) {
      return false;
    }

    try {
      const parts = signatureHeader.split("=");
      if (parts.length !== 2 || parts[0] !== "sha256") {
        return false;
      }

      const expectedHash = parts[1];
      const hmac = crypto.createHmac("sha256", appSecret);
      hmac.update(rawBody);
      const calculatedHash = hmac.digest("hex");

      const expectedBuffer = Buffer.from(expectedHash, "hex");
      const calculatedBuffer = Buffer.from(calculatedHash, "hex");

      if (expectedBuffer.length !== calculatedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
    } catch {
      return false;
    }
  },

  /**
   * Verify comment is within Meta's 7-day allowed messaging window
   */
  isCommentWithinMessagingWindow: (createdTimeSeconds: number): boolean => {
    if (!createdTimeSeconds) return false;
    const commentDateMs = createdTimeSeconds * 1000;
    const sevenDaysAgoMs = Date.now() - 7 * 86400 * 1000;
    return commentDateMs >= sevenDaysAgoMs;
  },
};
