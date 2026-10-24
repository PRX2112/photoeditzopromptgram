import { prisma, checkDatabaseConnection } from "@/lib/prisma";
import { instagramService } from "@/lib/instagram";
import { dbService } from "@/lib/db-service";

export type DMReservationStatus =
  | "RESERVED"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "UNKNOWN"
  | "SUPPRESSED";

export interface ReservationResult {
  isReserved: boolean;
  reservationId?: string;
  isDuplicate: boolean;
  status: DMReservationStatus;
  message?: string;
}

export interface SendDMResult {
  success: boolean;
  status: DMReservationStatus;
  messageId?: string;
  error?: string;
}

// In-memory atomic reservation registry for offline/preview fallback
const inMemoryReservations = new Map<string, { id: string; status: DMReservationStatus; messageId?: string }>();

export const dmReservationService = {
  /**
   * Helper to construct unique composite identity key
   */
  getCompositeKey: (postId: string, instagramScopedUserId: string): string => {
    return `${postId}::${instagramScopedUserId}`;
  },

  /**
   * Atomically reserve delivery for a unique (postId, instagramScopedUserId) pair.
   * If a reservation already exists, returns isDuplicate: true and does NOT allow a second DM.
   */
  reserveDelivery: async (params: {
    postId: string;
    instagramScopedUserId: string;
    commentId: string;
    commentText?: string;
    commentTimestamp?: Date;
    matchedPromptId?: string;
    instagramAccountId?: string | null;
    instagramMediaId?: string | null;
  }): Promise<ReservationResult> => {
    const {
      postId,
      instagramScopedUserId,
      commentId,
      commentText,
      commentTimestamp,
      matchedPromptId,
      instagramAccountId,
      instagramMediaId,
    } = params;

    const dbCheck = await checkDatabaseConnection();

    if (dbCheck.ok) {
      try {
        // Atomic insert: Unique constraint @@unique([postId, instagramScopedUserId])
        // If this record already exists, Prisma throws P2002 (Unique constraint violation)
        const reservation = await prisma.promptRequest.create({
          data: {
            postId,
            instagramScopedUserId,
            firstCommentId: commentId,
            firstCommentTimestamp: commentTimestamp || new Date(),
            matchedPromptId,
            instagramAccountId,
            instagramMediaId: instagramMediaId || null,
            commentText,
            deliveryStatus: "RESERVED",
            reservedAt: new Date(),
            attemptCount: 0,
            incomingCommentId: commentId,
          },
        });

        return {
          isReserved: true,
          reservationId: reservation.id,
          isDuplicate: false,
          status: "RESERVED",
        };
      } catch (err: unknown) {
        // P2002: Unique constraint failed on (postId, instagramScopedUserId)
        if ((err as { code?: string })?.code === "P2002") {
          // Fetch existing reservation status
          const existing = await prisma.promptRequest.findUnique({
            where: {
              postId_instagramScopedUserId: {
                postId,
                instagramScopedUserId,
              },
            },
          });

          return {
            isReserved: false,
            reservationId: existing?.id,
            isDuplicate: true,
            status: "SUPPRESSED",
            message: `User ${instagramScopedUserId} has already qualified for a reply on post ${postId}. Duplicate suppressed.`,
          };
        }

        throw err;
      }
    }

    // In-memory atomic fallback
    const key = dmReservationService.getCompositeKey(postId, instagramScopedUserId);
    if (inMemoryReservations.has(key)) {
      const existing = inMemoryReservations.get(key)!;
      return {
        isReserved: false,
        reservationId: existing.id,
        isDuplicate: true,
        status: existing.status,
        message: "Duplicate comment on same post; DM suppressed.",
      };
    }

    const newId = `res_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    inMemoryReservations.set(key, { id: newId, status: "RESERVED" });

    // Also register in memory dbService
    await dbService.createPromptRequest({
      incomingCommentId: commentId,
      instagramMediaId: "ig_media",
      commenterId: instagramScopedUserId,
      commentText,
      matchedPostId: postId,
      matchedPromptId,
      deliveryStatus: "DELIVERED",
      deliveryMethod: "PRIVATE_REPLY",
      retryCount: 0,
    });

    return {
      isReserved: true,
      reservationId: newId,
      isDuplicate: false,
      status: "RESERVED",
    };
  },

  /**
   * Execute private reply delivery for an atomically claimed reservation
   */
  executeDelivery: async (params: {
    reservationId: string;
    commentId: string;
    messageText: string;
    instagramAccountId?: string | null;
  }): Promise<SendDMResult> => {
    const { reservationId, commentId, messageText } = params;
    const dbCheck = await checkDatabaseConnection();

    if (dbCheck.ok) {
      // 1. Atomically transition from RESERVED to SENDING
      const claimResult = await prisma.promptRequest.updateMany({
        where: {
          id: reservationId,
          deliveryStatus: { in: ["RESERVED", "FAILED"] },
        },
        data: {
          deliveryStatus: "SENDING",
          sendingAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        return {
          success: false,
          status: "SUPPRESSED",
          error: "Reservation is already SENDING, SENT, or UNKNOWN. Blind retry blocked.",
        };
      }

      // Check if Meta is configured
      if (!instagramService.isConfigured()) {
        const mockMsgId = `mock_dm_${Date.now()}`;
        await prisma.promptRequest.update({
          where: { id: reservationId },
          data: {
            deliveryStatus: "SENT",
            sentAt: new Date(),
            metaMessageId: mockMsgId,
            privateReplyId: mockMsgId,
            deliveredAt: new Date(),
            lastError: null,
          },
        });

        return {
          success: true,
          status: "SENT",
          messageId: mockMsgId,
        };
      }

      // Live Meta API call
      try {
        let tokenToUse = process.env.META_INSTAGRAM_ACCESS_TOKEN || "";
        let targetIgId = process.env.META_INSTAGRAM_ACCOUNT_ID || "17841479958291582";

        if (params.instagramAccountId) {
          const acc = await prisma.instagramAccount.findUnique({
            where: { id: params.instagramAccountId },
          });
          if (acc) {
            tokenToUse = acc.accessTokenEncrypted;
            targetIgId = acc.igUserId;
          }
        } else {
          const acc = await prisma.instagramAccount.findFirst({
            where: { isConnected: true },
          });
          if (acc) {
            tokenToUse = acc.accessTokenEncrypted;
            targetIgId = acc.igUserId;
          }
        }

        const result = await instagramService.sendPrivateReply(
          tokenToUse,
          targetIgId,
          commentId,
          messageText
        );

        if (result.success && result.messageId) {
          await prisma.promptRequest.update({
            where: { id: reservationId },
            data: {
              deliveryStatus: "SENT",
              sentAt: new Date(),
              metaMessageId: result.messageId,
              privateReplyId: result.messageId,
              deliveredAt: new Date(),
              lastError: null,
            },
          });

          return {
            success: true,
            status: "SENT",
            messageId: result.messageId,
          };
        } else {
          // Definitive failure
          await prisma.promptRequest.update({
            where: { id: reservationId },
            data: {
              deliveryStatus: "FAILED",
              lastError: result.error || "Meta private reply failed",
            },
          });

          return {
            success: false,
            status: "FAILED",
            error: result.error,
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isAmbiguous = errorMsg.includes("timeout") || errorMsg.includes("ECONNRESET");

        // Mark UNKNOWN if timeout occurred after request was dispatched to Meta
        const finalStatus: DMReservationStatus = isAmbiguous ? "UNKNOWN" : "FAILED";

        await prisma.promptRequest.update({
          where: { id: reservationId },
          data: {
            deliveryStatus: finalStatus,
            lastError: errorMsg,
          },
        });

        return {
          success: false,
          status: finalStatus,
          error: errorMsg,
        };
      }
    }

    // In-memory fallback
    return {
      success: true,
      status: "SENT",
      messageId: `mock_msg_${Date.now()}`,
    };
  },

  /**
   * Safely handle delivery failure, classifying timeouts as UNKNOWN to prevent blind retries
   */
  handleDeliveryFailure: async (
    reservationId: string,
    error: Error | string,
    isAmbiguous: boolean = false
  ): Promise<{ status: DMReservationStatus; canBlindlyRetry: boolean; error: string }> => {
    const errorMsg = typeof error === "string" ? error : error.message;
    const status: DMReservationStatus = isAmbiguous ? "UNKNOWN" : "FAILED";
    const canBlindlyRetry = !isAmbiguous;

    const dbCheck = await checkDatabaseConnection();
    if (dbCheck.ok) {
      await prisma.promptRequest.update({
        where: { id: reservationId },
        data: {
          deliveryStatus: status,
          lastError: errorMsg,
        },
      });
    }

    return { status, canBlindlyRetry, error: errorMsg };
  },
};
