import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { instagramService } from "../lib/instagram";
import { dbService, DatabaseError } from "../lib/db-service";
import { webhookHandler } from "../lib/webhooks";
import { encryptToken, decryptToken } from "../lib/crypto";
import type { InstagramWebhookPayload } from "@/types";

describe("Phase 1: Verification of Zero Mock Success Paths", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe("1. Missing Instagram Credentials", () => {
    test("isConfigured() returns false when META_APP_ID or META_APP_SECRET is missing", () => {
      delete process.env.META_APP_ID;
      delete process.env.META_APP_SECRET;
      assert.strictEqual(instagramService.isConfigured(), false);

      process.env.META_APP_ID = "123456789";
      delete process.env.META_APP_SECRET;
      assert.strictEqual(instagramService.isConfigured(), false);

      process.env.META_APP_ID = "";
      process.env.META_APP_SECRET = "secret";
      assert.strictEqual(instagramService.isConfigured(), false);
    });

    test("isConfigured() returns true only when both ID and SECRET are present and non-empty", () => {
      process.env.META_APP_ID = "123456789012345";
      process.env.META_APP_SECRET = "abcdef0123456789abcdef0123456789";
      assert.strictEqual(instagramService.isConfigured(), true);
    });

    test("exchangeCodeForToken throws error if credentials are not configured", async () => {
      delete process.env.META_APP_ID;
      delete process.env.META_APP_SECRET;

      await assert.rejects(
        async () => {
          await instagramService.exchangeCodeForToken("any_auth_code");
        },
        {
          message: "Meta App ID and Secret must be configured in environment variables",
        }
      );
    });
  });

  describe("2. Mocked Meta Failure Handling", () => {
    test("A mocked Meta container creation failure cannot mark a post as published", async () => {
      // Mock fetch returning OAuth error from Meta Graph API
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              message: "Error validating access token: Session has expired",
              type: "OAuthException",
              code: 190,
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      };

      const result = await instagramService.publishImagePost(
        "test_token",
        "17841400000000",
        "https://example.com/test.jpg",
        "Test Caption"
      );

      // Must be marked as failure and never produce a mediaId
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.mediaId, undefined);
      assert.match(result.error || "", /Failed to create media container/);
    });

    test("A container processing failure or timeout prevents publishing", async () => {
      let callCount = 0;
      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/media") && !urlStr.includes("fields=status_code")) {
          // Container creation succeeds
          return new Response(
            JSON.stringify({ id: "container_test_999" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("fields=status_code")) {
          // Container polling fails with ERROR
          callCount++;
          return new Response(
            JSON.stringify({ id: "container_test_999", status_code: "ERROR" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 400 });
      };

      const result = await instagramService.publishImagePost(
        "test_token",
        "17841400000000",
        "https://example.com/test.jpg",
        "Test Caption"
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.mediaId, undefined);
      assert.match(result.error || "", /Media container processing failed or timed out/);
    });

    test("A media_publish API error cannot return success or a media ID", async () => {
      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/media") && !urlStr.includes("media_publish") && !urlStr.includes("fields=status_code")) {
          return new Response(
            JSON.stringify({ id: "container_123" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("fields=status_code")) {
          return new Response(
            JSON.stringify({ id: "container_123", status_code: "FINISHED" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("/media_publish")) {
          return new Response(
            JSON.stringify({
              error: {
                message: "The media was not published due to an internal server error.",
                code: 2,
              },
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 400 });
      };

      const result = await instagramService.publishImagePost(
        "test_token",
        "17841400000000",
        "https://example.com/test.jpg",
        "Test Caption"
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.mediaId, undefined);
      assert.match(result.error || "", /Failed to publish media/);
    });
  });

  describe("3. Simulated DM / Private Reply Failure Handling", () => {
    test("A simulated DM failure cannot return success or produce a message ID", async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              message: "Cannot send private reply: The 7-day window has expired",
              code: 10,
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      };

      const result = await instagramService.sendPrivateReply(
        "test_token",
        "17841400000000",
        "comment_12345",
        "Here is your prompt"
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.messageId, undefined);
      assert.strictEqual(result.errorCode, 10);
      assert.match(result.error || "", /7-day window/);
    });

    test("A webhook comment without connected account fails and is recorded as FAILED, never DELIVERED", async () => {
      const origGetPosts = dbService.getPosts;
      const origGetAccount = dbService.getConnectedInstagramAccount;

      // Stub getPosts to return a post with a valid seeded prompt "p-1"
      dbService.getPosts = (async () => [
        {
          id: "post_1",
          promptId: "p-1",
          instagramAccountId: null,
          caption: "Test caption",
          hashtags: "#test",
          commentKeyword: "PROMPT",
          mediaType: "IMAGE",
          temporaryImageUrl: "https://example.com/test.jpg",
          temporaryAssetKey: null,
          instagramMediaId: "ig_media_555",
          instagramPermalink: null,
          status: "PUBLISHED",
          scheduledFor: null,
          publishedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          retryCount: 0,
        },
      ]) as unknown as typeof dbService.getPosts;
      dbService.getConnectedInstagramAccount = async () => null;

      try {
        const payload: InstagramWebhookPayload = {
          object: "instagram",
          entry: [
            {
              id: "17841400000000",
              time: Math.floor(Date.now() / 1000),
              changes: [
                {
                  field: "comments",
                  value: {
                    id: "cmt_99999",
                    text: "Please send me the PROMPT!",
                    from: { id: "user_111", username: "photofan" },
                    media: { id: "ig_media_555" },
                  },
                },
              ],
            },
          ],
        };

        const results = await webhookHandler.processWebhookEvent(payload);

        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].action, "FAILED");
        assert.match(results[0].message || "", /No connected Instagram/);
      } finally {
        dbService.getPosts = origGetPosts;
        dbService.getConnectedInstagramAccount = origGetAccount;
      }
    });
  });

  describe("4. Database Write Confirmation & Failure Handling", () => {
    test("A failed database write cannot produce a false save confirmation", async () => {
      // In this environment where Neon is not connected, write operations must throw DatabaseError
      await assert.rejects(
        async () => {
          await dbService.createPost({
            promptId: "prompt_id_test",
            instagramAccountId: null,
            caption: "Amazing Landscape",
            hashtags: "#nature #photography",
            commentKeyword: "PROMPT",
            mediaType: "IMAGE",
            temporaryImageUrl: "https://example.com/photo.jpg",
            temporaryAssetKey: null,
            status: "DRAFT",
            scheduledFor: null,
            publishedAt: null,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof DatabaseError || err instanceof Error);
          assert.match((err as Error).message, /Database connection unavailable/);
          return true;
        }
      );
    });

    test("Updating a post without confirmed database connection throws DatabaseError", async () => {
      await assert.rejects(
        async () => {
          await dbService.updatePost("any_post_id", {
            status: "PUBLISHED",
            instagramMediaId: "fake_id_should_never_work",
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof DatabaseError || err instanceof Error);
          assert.match((err as Error).message, /Database connection unavailable/);
          return true;
        }
      );
    });

    test("Creating a prompt without confirmed database connection throws DatabaseError", async () => {
      await assert.rejects(
        async () => {
          await dbService.createPrompt({
            title: "Epic Sunset",
            originalPrompt: "Golden hour sunset with dramatic lighting",
            category: "Landscape",
            tags: ["sunset"],
            slug: "epic-sunset-test",
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof DatabaseError || err instanceof Error);
          return true;
        }
      );
    });
  });

  describe("5. No Fabricated Identifiers in Production Logic", () => {
    test("instagramService never generates fabricated media IDs on publish failure", async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ error: { message: "Internal Server Error" } }), { status: 500 });
      };

      const result = await instagramService.publishImagePost(
        "test_token",
        "17841400000000",
        "https://example.com/test.jpg",
        "Test Caption"
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.mediaId, undefined);
      assert.strictEqual(result.permalink, undefined);
    });

    test("instagramService never generates fabricated message IDs on private reply failure", async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ error: { message: "Unauthorized token" } }), { status: 401 });
      };

      const result = await instagramService.sendPrivateReply(
        "test_token",
        "17841400000000",
        "cmt_123",
        "Test text"
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.messageId, undefined);
    });
  });

  describe("6. Token Encryption at Rest", () => {
    test("Tokens are encrypted with AES-256-GCM and decrypted accurately", () => {
      const rawToken = "EAABwzLixnjYBO987654321longLivedAccessTokenExample";
      const encrypted = encryptToken(rawToken);

      // Verify format is iv:authTag:ciphertext
      const parts = encrypted.split(":");
      assert.strictEqual(parts.length, 3, "Encrypted payload must have 3 colon-separated parts");
      assert.strictEqual(parts[0].length, 24, "IV must be 12 bytes (24 hex characters)");
      assert.strictEqual(parts[1].length, 32, "Auth tag must be 16 bytes (32 hex characters)");

      // Decryption accurately recovers raw token
      const decrypted = decryptToken(encrypted);
      assert.strictEqual(decrypted, rawToken);
    });

    test("Tampered ciphertext throws error on decryption", () => {
      const rawToken = "EAABwzLixnjYBOsecret";
      const encrypted = encryptToken(rawToken);
      const parts = encrypted.split(":");

      // Corrupt the ciphertext
      const tamperedParts = [parts[0], parts[1], parts[2].slice(0, -2) + "00"];
      const tampered = tamperedParts.join(":");

      assert.throws(() => {
        decryptToken(tampered);
      });
    });
  });

  describe("7. Genuine Meta Success Verification", () => {
    test("A genuine Meta publishing response returns real mediaId and permalink", async () => {
      const realMediaId = "17999888777666555";
      const realPermalink = "https://www.instagram.com/p/DB123456789/";

      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/media") && !urlStr.includes("media_publish") && !urlStr.includes("fields=status_code") && !urlStr.includes("fields=permalink")) {
          return new Response(
            JSON.stringify({ id: "container_998877" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("fields=status_code")) {
          return new Response(
            JSON.stringify({ id: "container_998877", status_code: "FINISHED" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("/media_publish")) {
          return new Response(
            JSON.stringify({ id: realMediaId }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("fields=permalink")) {
          return new Response(
            JSON.stringify({ id: realMediaId, permalink: realPermalink }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("{}", { status: 400 });
      };

      const result = await instagramService.publishImagePost(
        "real_or_test_token",
        "17841400000000",
        "https://example.com/real_photo.jpg",
        "Real Verified Caption"
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mediaId, realMediaId);
      assert.strictEqual(result.permalink, realPermalink);
    });

    test("A genuine Meta private reply response returns real messageId", async () => {
      const realMessageId = "m_mid.$cAAAM1234567890abcdef";

      globalThis.fetch = async (url) => {
        return new Response(
          JSON.stringify({
            message_id: realMessageId,
            recipient_id: "user_111",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const result = await instagramService.sendPrivateReply(
        "valid_token",
        "17841400000000",
        "cmt_99999",
        "Here is the prompt: http://localhost:3000/p/golden-hour"
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.messageId, realMessageId);
    });
  });
});
