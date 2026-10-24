import { describe, it, expect, vi, beforeEach } from "vitest";
import { dmReservationService } from "@/lib/instagram/dm-reservation";
import { webhookProcessor } from "@/lib/webhooks";
import { prisma } from "@/lib/prisma";

const testStore = vi.hoisted(() => new Map<string, any>());

// Mock prisma for testing atomic reservation and concurrency
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      promptRequest: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const compositeKey = `${data.postId}:${data.instagramScopedUserId}`;
          if (testStore.has(compositeKey)) {
            const error: any = new Error("Unique constraint failed on the fields: (`postId`,`instagramScopedUserId`)");
            error.code = "P2002";
            error.meta = { target: ["postId", "instagramScopedUserId"] };
            throw error;
          }
          const record = {
            id: `req_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          testStore.set(compositeKey, record);
          return record;
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where.id) {
            for (const item of testStore.values()) {
              if (item.id === where.id) return item;
            }
          }
          if (where.postId_instagramScopedUserId) {
            const key = `${where.postId_instagramScopedUserId.postId}:${where.postId_instagramScopedUserId.instagramScopedUserId}`;
            return testStore.get(key) || null;
          }
          return null;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          for (const [key, item] of testStore.entries()) {
            if (item.id === where.id) {
              const updated = { ...item, ...data };
              testStore.set(key, updated);
              return updated;
            }
          }
          return null;
        }),
      },
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      post: {
        findUnique: vi.fn(),
      },
    },
    checkDatabaseConnection: vi.fn().mockResolvedValue({ ok: true }),
  };
});

describe("Instagram DM Delivery Idempotency & Reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testStore.clear();
  });

  describe("Single Automated DM per User per Published Post", () => {
    it("first qualifying comment creates one atomic reservation", async () => {
      const reservation = await dmReservationService.reserveDelivery({
        postId: "post-autumn-1",
        instagramScopedUserId: "ig_user_111",
        commentId: "comment_1",
        commentText: "PROMPT please!",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });

      expect(reservation.isDuplicate).toBe(false);
      expect(reservation.isReserved).toBe(true);
      expect(reservation.status).toBe("RESERVED");
      expect(reservation.reservationId).toBeDefined();
    });

    it("repeat comment from same user on same post is suppressed and creates no additional reservation", async () => {
      // First comment
      const firstRes = await dmReservationService.reserveDelivery({
        postId: "post-autumn-1",
        instagramScopedUserId: "ig_user_111",
        commentId: "comment_1",
        commentText: "PROMPT please!",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });
      expect(firstRes.isDuplicate).toBe(false);

      // Repeat comment from same user on the same post
      const repeatRes = await dmReservationService.reserveDelivery({
        postId: "post-autumn-1",
        instagramScopedUserId: "ig_user_111",
        commentId: "comment_2_repeat",
        commentText: "PROMPT again!!",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });

      expect(repeatRes.isDuplicate).toBe(true);
      expect(repeatRes.isReserved).toBe(false);
      expect(repeatRes.status).toBe("SUPPRESSED");
      expect(repeatRes.reservationId).toBe(firstRes.reservationId);
    });

    it("same user commenting on a DIFFERENT post can qualify independently", async () => {
      // User comments on post 1
      const resPost1 = await dmReservationService.reserveDelivery({
        postId: "post-1",
        instagramScopedUserId: "ig_user_111",
        commentId: "comment_post1",
        commentText: "PROMPT",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });
      expect(resPost1.isReserved).toBe(true);

      // Same user comments on post 2
      const resPost2 = await dmReservationService.reserveDelivery({
        postId: "post-2",
        instagramScopedUserId: "ig_user_111",
        commentId: "comment_post2",
        commentText: "PROMPT",
        matchedPromptId: "prompt-2",
        instagramMediaId: "media_2",
      });
      expect(resPost2.isReserved).toBe(true);
      expect(resPost2.isDuplicate).toBe(false);
      expect(resPost2.reservationId).not.toBe(resPost1.reservationId);
    });

    it("different users commenting on the SAME post receive independent reservations", async () => {
      // User A on post 1
      const resUserA = await dmReservationService.reserveDelivery({
        postId: "post-1",
        instagramScopedUserId: "ig_user_A",
        commentId: "comment_user_a",
        commentText: "PROMPT",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });
      expect(resUserA.isReserved).toBe(true);

      // User B on post 1
      const resUserB = await dmReservationService.reserveDelivery({
        postId: "post-1",
        instagramScopedUserId: "ig_user_B",
        commentId: "comment_user_b",
        commentText: "PROMPT",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });
      expect(resUserB.isReserved).toBe(true);
      expect(resUserB.isDuplicate).toBe(false);
      expect(resUserB.reservationId).not.toBe(resUserA.reservationId);
    });
  });

  describe("Concurrent Worker Safety & Race Conditions", () => {
    it("concurrent workers attempting to reserve same post/user pair collide on DB unique constraint", async () => {
      const attempt1 = dmReservationService.reserveDelivery({
        postId: "post-race-1",
        instagramScopedUserId: "ig_race_user",
        commentId: "comm_worker_1",
        commentText: "PROMPT",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });

      const attempt2 = dmReservationService.reserveDelivery({
        postId: "post-race-1",
        instagramScopedUserId: "ig_race_user",
        commentId: "comm_worker_2",
        commentText: "PROMPT",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });

      const [res1, res2] = await Promise.all([attempt1, attempt2]);

      // Exactly one must win the reservation, while the other must be recognized as duplicate
      const winners = [res1, res2].filter((r) => r.isReserved && !r.isDuplicate);
      const suppressed = [res1, res2].filter((r) => r.isDuplicate && !r.isReserved);

      expect(winners.length).toBe(1);
      expect(suppressed.length).toBe(1);
    });
  });

  describe("Ambiguous Outcome Classification (UNKNOWN)", () => {
    it("marks timeout/network error as UNKNOWN and prevents blind retries", async () => {
      // Create a reservation first
      const reservation = await dmReservationService.reserveDelivery({
        postId: "post-timeout-1",
        instagramScopedUserId: "ig_user_timeout",
        commentId: "comm_timeout_1",
        commentText: "PROMPT",
        matchedPromptId: "prompt-1",
        instagramMediaId: "media_1",
      });

      // Mock a network timeout during Meta private reply API call
      const timeoutError = new Error("ETIMEDOUT: Connection to graph.facebook.com timed out");
      const outcome = await dmReservationService.handleDeliveryFailure(
        reservation.reservationId!,
        timeoutError,
        true // isAmbiguous = true
      );

      expect(outcome.status).toBe("UNKNOWN");
      expect(outcome.canBlindlyRetry).toBe(false);
    });
  });

  describe("Webhook Signature & Security Verification", () => {
    it("verifies valid HMAC-SHA256 signatures", () => {
      const secret = "test_meta_app_secret";
      const rawBody = JSON.stringify({ object: "instagram", entry: [] });
      const crypto = require("crypto");
      const validHash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const signatureHeader = `sha256=${validHash}`;

      const isValid = webhookProcessor.verifySignature(rawBody, signatureHeader, secret);
      expect(isValid).toBe(true);
    });

    it("rejects forged or modified webhook signatures", () => {
      const secret = "test_meta_app_secret";
      const rawBody = JSON.stringify({ object: "instagram", entry: [] });
      const invalidSignature = "sha256=invalid_hash_value_1234567890abcdef";

      const isValid = webhookProcessor.verifySignature(rawBody, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    it("rejects comments older than 7 days (Meta 7-day messaging policy window)", () => {
      const eightDaysAgoSeconds = Math.floor(Date.now() / 1000) - 8 * 86400;
      const isEligible = webhookProcessor.isCommentWithinMessagingWindow(eightDaysAgoSeconds);
      expect(isEligible).toBe(false);
    });

    it("accepts comments within the 7-day messaging policy window", () => {
      const oneHourAgoSeconds = Math.floor(Date.now() / 1000) - 3600;
      const isEligible = webhookProcessor.isCommentWithinMessagingWindow(oneHourAgoSeconds);
      expect(isEligible).toBe(true);
    });
  });
});
