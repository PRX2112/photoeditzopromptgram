import { dbService } from "./db-service";
import { instagramService } from "./instagram";
import type { InstagramWebhookPayload } from "@/types";

export interface ProcessCommentResult {
  commentId: string;
  action: "DELIVERED" | "IGNORED" | "FAILED" | "DUPLICATE";
  message?: string;
  slug?: string;
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
   * Process incoming Instagram webhook payload
   */
  processWebhookEvent: async (payload: InstagramWebhookPayload): Promise<ProcessCommentResult[]> => {
    const results: ProcessCommentResult[] = [];

    // Verify automation setting is globally enabled
    const settings = await dbService.getAutomationSettings();
    if (!settings.isAutomationEnabled) {
      return [{ commentId: "all", action: "IGNORED", message: "Automation is globally disabled in Settings" }];
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== "comments") continue;

        const comment = change.value;
        const commentId = comment.id;
        const commentText = comment.text || "";
        const mediaId = comment.media?.id;
        const commenterId = comment.from?.id;

        // 1. Idempotency Check: Prevent duplicate replies to the same comment
        const existingRequests = await dbService.getPromptRequests();
        const alreadyProcessed = existingRequests.find((r) => r.incomingCommentId === commentId);

        if (alreadyProcessed) {
          results.push({
            commentId,
            action: "DUPLICATE",
            message: `Comment ${commentId} already processed with status: ${alreadyProcessed.deliveryStatus}`,
          });
          continue;
        }

        // 2. Check 7-day Meta private reply window
        if (comment.created_time) {
          const commentDate = new Date(comment.created_time * 1000);
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000);
          if (commentDate < sevenDaysAgo) {
            try {
              await dbService.createPromptRequest({
                incomingCommentId: commentId,
                instagramMediaId: mediaId || "unknown",
                commenterId,
                commentText,
                matchedPostId: null,
                matchedPromptId: null,
                deliveryStatus: "FAILED",
                deliveryMethod: "PRIVATE_REPLY",
                privateReplyId: null,
                retryCount: 0,
                errorMessage: "Comment is older than 7 days; outside Meta Private Reply window",
                deliveredAt: null,
              });
            } catch (dbErr) {
              console.error("DB persist error in webhook:", dbErr);
            }

            results.push({
              commentId,
              action: "FAILED",
              message: "Comment is older than 7 days; outside Meta Private Reply window",
            });
            continue;
          }
        }

        // 3. Find matched Post record by Instagram Media ID
        const allPosts = await dbService.getPosts();
        const matchedPost = allPosts.find((p) => p.instagramMediaId === mediaId);

        // Determine target keyword (Post-specific keyword takes precedence over globalKeyword)
        const targetKeyword = matchedPost?.commentKeyword || settings.globalKeyword || "PROMPT";

        // 4. Keyword matching
        const isMatched = matchesKeyword(commentText, targetKeyword);

        if (!isMatched) {
          // Record as IGNORED request for visibility in automation logs
          try {
            await dbService.createPromptRequest({
              incomingCommentId: commentId,
              instagramMediaId: mediaId || "unknown",
              commenterId,
              commentText,
              matchedPostId: matchedPost?.id || null,
              matchedPromptId: matchedPost?.promptId || null,
              deliveryStatus: "IGNORED",
              deliveryMethod: "NONE",
              privateReplyId: null,
              retryCount: 0,
              errorMessage: `Comment did not contain keyword: ${targetKeyword}`,
              deliveredAt: null,
            });
          } catch (dbErr) {
            console.error("DB persist error in webhook:", dbErr);
          }

          results.push({
            commentId,
            action: "IGNORED",
            message: `No matching keyword '${targetKeyword}' found in comment text`,
          });
          continue;
        }

        // 5. Match Prompt and construct public URL
        const matchedPrompt = matchedPost?.promptId
          ? await dbService.getPromptById(matchedPost.promptId)
          : null;

        if (!matchedPrompt) {
          try {
            await dbService.createPromptRequest({
              incomingCommentId: commentId,
              instagramMediaId: mediaId || "unknown",
              commenterId,
              commentText,
              matchedPostId: matchedPost?.id || null,
              matchedPromptId: null,
              deliveryStatus: "FAILED",
              deliveryMethod: "PRIVATE_REPLY",
              privateReplyId: null,
              retryCount: 0,
              errorMessage: "No prompt associated with this Instagram post",
              deliveredAt: null,
            });
          } catch (dbErr) {
            console.error("DB persist error in webhook:", dbErr);
          }

          results.push({
            commentId,
            action: "FAILED",
            message: "No prompt associated with this post",
          });
          continue;
        }

        const promptUrl = `${baseUrl}/p/${matchedPrompt.slug}`;
        const replyText = settings.replyTemplate
          ? settings.replyTemplate
              .replace("{prompt_url}", promptUrl)
              .replace("{prompt_title}", matchedPrompt.title)
              .replace("{category}", matchedPrompt.category)
          : `Here is the photography prompt you requested: ${promptUrl}`;

        // 6. Send private reply via official Meta API
        const connectedAccount = await dbService.getConnectedInstagramAccount();

        if (!connectedAccount || !connectedAccount.accessTokenEncrypted) {
          // Cannot deliver without a connected Instagram account
          try {
            await dbService.createPromptRequest({
              incomingCommentId: commentId,
              instagramMediaId: mediaId || "unknown",
              commenterId,
              commentText,
              matchedPostId: matchedPost?.id || null,
              matchedPromptId: matchedPrompt.id,
              deliveryStatus: "FAILED",
              deliveryMethod: "PRIVATE_REPLY",
              privateReplyId: null,
              retryCount: 0,
              errorMessage: "No connected Instagram Professional account found to dispatch private reply",
              deliveredAt: null,
            });
          } catch (dbErr) {
            console.error("DB persist error in webhook:", dbErr);
          }

          results.push({
            commentId,
            action: "FAILED",
            message: "No connected Instagram account found to send private reply",
          });
          continue;
        }

        // Real API invocation
        const sendResult = await instagramService.sendPrivateReply(
          connectedAccount.accessTokenEncrypted,
          connectedAccount.igUserId,
          commentId,
          replyText
        );

        const isDelivered = sendResult.success && Boolean(sendResult.messageId);

        // 7. Persist verified PromptRequest record
        try {
          await dbService.createPromptRequest({
            incomingCommentId: commentId,
            instagramMediaId: mediaId || "unknown",
            commenterId,
            commentText,
            matchedPostId: matchedPost?.id || null,
            matchedPromptId: matchedPrompt.id,
            deliveryStatus: isDelivered ? "DELIVERED" : "FAILED",
            deliveryMethod: "PRIVATE_REPLY",
            privateReplyId: isDelivered ? sendResult.messageId || null : null,
            retryCount: 0,
            errorMessage: isDelivered ? null : sendResult.error || "Meta private reply failed",
            deliveredAt: isDelivered ? new Date().toISOString() : null,
          });
        } catch (dbErr) {
          console.error("DB persist error in webhook:", dbErr);
        }

        results.push({
          commentId,
          action: isDelivered ? "DELIVERED" : "FAILED",
          slug: matchedPrompt.slug,
          message: isDelivered
            ? `Prompt delivered via private reply: ${promptUrl}`
            : `Failed to deliver private reply: ${sendResult.error}`,
        });
      }
    }

    return results;
  },
};

export const webhookHandler = webhookProcessor;

