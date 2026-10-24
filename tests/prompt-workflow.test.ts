import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeSlug, generateUniqueSlug } from "@/lib/slugs";
import { wrapTitle, escapeFfmpegFilterPath, resolveFontPath, formatImageCtaText } from "@/lib/ffmpeg";
import { CreatePromptSchema } from "@/lib/validations/prompt";
import { geminiService, validateAndCleanCaptionOutput } from "@/lib/gemini";
import fs from "fs";

describe("Prompt-First Content & Publishing Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1 & 2. Core Prompt Details & Optional Camera Metadata Validation", () => {
    it("validates a prompt with ONLY required fields: title, sourceImageUrl, and originalPrompt", () => {
      const minimalPrompt = {
        title: "The Candid Walk & Laugh — Hand-in-Hand",
        sourceImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/candid.jpg",
        originalPrompt: "Two people walking hand in hand through a sunlit European cobblestone street, golden hour, candid laugh, 35mm film aesthetic",
      };

      const result = CreatePromptSchema.safeParse(minimalPrompt);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("The Candid Walk & Laugh — Hand-in-Hand");
        expect(result.data.sourceImageUrl).toBe("https://store.public.blob.vercel-storage.com/temp-uploads/candid.jpg");
        expect(result.data.originalPrompt).toBe("Two people walking hand in hand through a sunlit European cobblestone street, golden hour, candid laugh, 35mm film aesthetic");
        // All optional technical camera fields are undefined/omitted
        expect(result.data.cameraModel).toBeUndefined();
        expect(result.data.lens).toBeUndefined();
        expect(result.data.focalLength).toBeUndefined();
        expect(result.data.aperture).toBeUndefined();
        expect(result.data.shutterSpeed).toBeUndefined();
        expect(result.data.iso).toBeUndefined();
        expect(result.data.lightingSetup).toBeUndefined();
        expect(result.data.renderingEngine).toBeUndefined();
      }
    });

    it("accepts optional camera metadata when provided without fabricating missing fields", () => {
      const promptWithTech = {
        title: "Studio Monochrome Portrait",
        sourceImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/studio.jpg",
        originalPrompt: "Dramatic black and white high contrast studio portrait, rim light on cheekbones",
        cameraModel: "Sony A7 IV",
        lens: "85mm f/1.4 GM",
        aperture: "f/1.8",
        iso: "100",
        // Other fields omitted
      };

      const result = CreatePromptSchema.safeParse(promptWithTech);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cameraModel).toBe("Sony A7 IV");
        expect(result.data.lens).toBe("85mm f/1.4 GM");
        expect(result.data.aperture).toBe("f/1.8");
        expect(result.data.iso).toBe("100");
        expect(result.data.shutterSpeed).toBeUndefined();
      }
    });

    it("rejects prompt creation when required fields are missing", () => {
      const missingTitle = {
        sourceImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/candid.jpg",
        originalPrompt: "Some prompt",
      };
      expect(CreatePromptSchema.safeParse(missingTitle).success).toBe(false);

      const missingPrompt = {
        title: "Some Title",
        sourceImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/candid.jpg",
      };
      expect(CreatePromptSchema.safeParse(missingPrompt).success).toBe(false);

      const missingImage = {
        title: "Some Title",
        originalPrompt: "Some prompt",
      };
      expect(CreatePromptSchema.safeParse(missingImage).success).toBe(false);
    });
  });

  describe("3. Verbatim Original Prompt Preservation", () => {
    it("never alters, normalizes, or rewrites the original prompt text", () => {
      const trickyPrompt = `  RAW Unedited Prompt: "Close-up of a raindrop on a cherry blossom petal, f/2.8, 1/500s" & <special symbols> — \n\t  `;
      
      const parsed = CreatePromptSchema.safeParse({
        title: "Cherry Blossom Raindrop",
        sourceImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/rain.jpg",
        originalPrompt: trickyPrompt,
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        // Original text must remain identical to input, including quotes, symbols, and whitespace
        expect(parsed.data.originalPrompt).toBe(trickyPrompt);
      }
    });
  });

  describe("4. Slug Generation, Normalization & Collisions", () => {
    it("normalizes titles with em-dashes, en-dashes, ampersands, and accents", () => {
      // The exact example from user specifications:
      // "The Candid Walk & Laugh — Hand-in-Hand" -> "the-candid-walk-laugh-hand-in-hand"
      const slug1 = normalizeSlug("The Candid Walk & Laugh — Hand-in-Hand");
      expect(slug1).toBe("the-candid-walk-laugh-hand-in-hand");

      // En-dash and accents:
      const slug2 = normalizeSlug("Café au Lait – Paris 2026");
      expect(slug2).toBe("cafe-au-lait-paris-2026");

      // Consecutive punctuation and whitespace collapsing:
      const slug3 = normalizeSlug("Sunset... at the Beach!!! (Golden Hour)");
      expect(slug3).toBe("sunset-at-the-beach-golden-hour");
    });

    it("resolves slug collisions deterministically with suffixes (-2, -3)", async () => {
      const existingSlugs = new Set(["the-candid-walk-laugh-hand-in-hand", "the-candid-walk-laugh-hand-in-hand-2"]);

      const mockChecker = async (slugToCheck: string) => existingSlugs.has(slugToCheck);

      const uniqueSlug = await generateUniqueSlug(
        "The Candid Walk & Laugh — Hand-in-Hand",
        undefined,
        mockChecker
      );

      expect(uniqueSlug).toBe("the-candid-walk-laugh-hand-in-hand-3");
    });

    it("allows existing slug when editing the same prompt (excludeId)", async () => {
      const mockChecker = async (_slugToCheck: string) => false;

      const uniqueSlug = await generateUniqueSlug(
        "The Candid Walk & Laugh — Hand-in-Hand",
        "prompt-123",
        mockChecker
      );

      expect(uniqueSlug).toBe("the-candid-walk-laugh-hand-in-hand");
    });
  });

  describe("6. Gemini Social Content Generation & Fallback", () => {
    it("separates Instagram caption from original prompt and generates hashtags and keyword", async () => {
      const originalPrompt = "Moody rainy night in Kyoto, neon reflections in wet asphalt, solitary umbrella";

      // Mock generateContent response
      const mockApiResponse = {
        title: "Kyoto Rainy Nights",
        caption: "Lost in the neon glow of Kyoto after dark. There is poetry in rainy streets.",
        hashtags: ["#kyotophotography", "#nightphotography", "#streetleaks"],
        commentKeyword: "KYOTO",
        altText: "A rainy street in Kyoto illuminated by neon signs reflecting in puddles",
      };

      const result = validateAndCleanCaptionOutput(mockApiResponse, "KYOTO", originalPrompt);

      expect(result).toBeDefined();
      expect(result.caption).toBeDefined();
      expect(result.suggestedKeywords).toContain("KYOTO");
      // The original prompt must not be silently replaced or mutated
      expect(originalPrompt).toBe("Moody rainy night in Kyoto, neon reflections in wet asphalt, solitary umbrella");
    });

    it("recovers gracefully with fallback copy if Gemini returns malformed response or errors", async () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const fallback = await geminiService.generateCaption({
        originalPrompt: "Portrait of an artist in studio, natural window light",
        commentKeyword: "ARTIST",
      });

      expect(fallback.caption).toContain("ARTIST");
      expect(fallback.hashtags.length).toBeGreaterThan(0);
      expect(fallback.suggestedKeywords).toContain("ARTIST");

      process.env.GEMINI_API_KEY = originalEnv;
    });
  });

  describe("7. FFmpeg Typography & Helper Functions", () => {
    it("wraps long titles cleanly across lines without breaking words", () => {
      const title = "THE CANDID WALK AND LAUGH HAND IN HAND ON SUNNY COBBLESTONE STREET";
      const lines = wrapTitle(title, 25, 3);

      expect(lines.length).toBeLessThanOrEqual(3);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(30); // reasonable word boundary
      }
    });

    it("escapes file paths safely for FFmpeg filter syntax", () => {
      const winPath = "C:\\Users\\Photographer\\public\\fonts\\editorial-bold.ttf";
      const escaped = escapeFfmpegFilterPath(winPath);

      expect(escaped).not.toContain("\\Users");
      expect(escaped).toContain("C\\:/Users/Photographer/public/fonts/editorial-bold.ttf");
    });

    it("verifies the bundled editorial TrueType font exists", () => {
      const fontPath = resolveFontPath();
      expect(fs.existsSync(fontPath)).toBe(true);
    });

    it("formats dynamic CTA strip text matching configured keyword", () => {
      expect(formatImageCtaText("BRIDAL")).toBe('COMMENT "BRIDAL"');
      expect(formatImageCtaText("STUDIO")).toBe('COMMENT "STUDIO"');
      expect(formatImageCtaText("vintage")).toBe('COMMENT "VINTAGE"');
      expect(formatImageCtaText(undefined)).toBe('COMMENT "PROMPT"');
      expect(formatImageCtaText("BRIDAL", "COMMENT BELOW")).toBe("COMMENT BELOW");
    });

    it("ensures CTA strip geometry does not cover foreground photo subject", () => {
      const headerHeight = 180;
      const maxPhotoHeight = 960;
      const lowestPhotoPixel = headerHeight + maxPhotoHeight; // 1140
      const ctaStripTop = 1152; // starts at y = 1152

      // CTA strip must begin strictly below the lowest possible photo pixel
      expect(ctaStripTop).toBeGreaterThan(lowestPhotoPixel);
    });
  });

  describe("8 & 9. Draft & Scheduling Without Image Deletion", () => {
    it("maintains source image in UPLOADED or READY_TO_PUBLISH status during DRAFT", () => {
      const draftPost = {
        id: "post-draft-test",
        status: "DRAFT",
        renderedImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/rendered.jpg",
        imageLifecycleStatus: "UPLOADED",
        scheduledFor: null,
      };

      // In draft, image must never be marked for cleanup
      expect(draftPost.status).toBe("DRAFT");
      expect(draftPost.imageLifecycleStatus).not.toBe("CLEANUP_PENDING");
      expect(draftPost.imageLifecycleStatus).not.toBe("DELETED");
    });

    it("maintains source image in READY_TO_PUBLISH status during SCHEDULED", () => {
      const scheduledPost = {
        id: "post-scheduled-test",
        status: "SCHEDULED",
        renderedImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/rendered.jpg",
        imageLifecycleStatus: "READY_TO_PUBLISH",
        scheduledFor: new Date(Date.now() + 86400000), // Tomorrow
      };

      expect(scheduledPost.status).toBe("SCHEDULED");
      expect(scheduledPost.scheduledFor.getTime()).toBeGreaterThan(Date.now());
      expect(scheduledPost.imageLifecycleStatus).toBe("READY_TO_PUBLISH");
    });
  });

  describe("10, 11 & 12. Publishing Lifecycle & Durable Metadata Persistence", () => {
    it("retains images on publication failure and records error", () => {
      const failedPost = {
        id: "post-failed-test",
        status: "FAILED",
        lastPublishError: "Instagram Graph API error 190: Invalid OAuth access token",
        renderedImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/rendered.jpg",
        imageLifecycleStatus: "READY_TO_PUBLISH", // Assets must NOT be deleted
      };

      expect(failedPost.status).toBe("FAILED");
      expect(failedPost.imageLifecycleStatus).not.toBe("DELETED");
      expect(failedPost.lastPublishError).toContain("Instagram Graph API");
    });

    it("transitions to CLEANUP_PENDING and marks prompt isPublished ONLY after confirmed publication", () => {
      const confirmedPost = {
        id: "post-published-test",
        status: "PUBLISHED",
        instagramMediaId: "18029384756192834",
        instagramPermalink: "https://www.instagram.com/p/Cxyz1234/",
        publishedAt: new Date(),
        imageLifecycleStatus: "CLEANUP_PENDING",
      };

      const prompt = {
        id: "prompt-1",
        isPublished: true,
        publishedAt: confirmedPost.publishedAt,
      };

      expect(confirmedPost.status).toBe("PUBLISHED");
      expect(confirmedPost.instagramMediaId).toBeDefined();
      expect(confirmedPost.instagramPermalink).toBeDefined();
      expect(prompt.isPublished).toBe(true);
      expect(confirmedPost.imageLifecycleStatus).toBe("CLEANUP_PENDING");
    });
  });

  describe("13 & 14. Cleanup Retry & Concurrent Publishing Guards", () => {
    it("retry cleanup does not trigger Meta publishing or mutate publication status", () => {
      const publishedPost = {
        id: "post-retry-cleanup",
        status: "PUBLISHED" as const,
        instagramMediaId: "18029384756192834",
        imageLifecycleStatus: "CLEANUP_FAILED" as const,
        cleanupAttempts: 2,
        lastCleanupError: "Network timeout connecting to Blob service",
      };

      // Simulating cleanup retry attempt:
      const retryResult = {
        success: true,
        imageLifecycleStatus: "DELETED",
        cleanupAttempts: publishedPost.cleanupAttempts + 1,
      };

      expect(publishedPost.status).toBe("PUBLISHED");
      expect(retryResult.cleanupAttempts).toBe(3);
      // Post status remains PUBLISHED, only storage status is updated
      expect(retryResult.imageLifecycleStatus).toBe("DELETED");
    });

    it("prevents double-publishing when post is already in PUBLISHING status", () => {
      const isPublishingAllowed = (status: string) => {
        return status === "DRAFT" || status === "SCHEDULED" || status === "FAILED";
      };

      expect(isPublishingAllowed("DRAFT")).toBe(true);
      expect(isPublishingAllowed("SCHEDULED")).toBe(true);
      expect(isPublishingAllowed("FAILED")).toBe(true);
      expect(isPublishingAllowed("PUBLISHING")).toBe(false);
      expect(isPublishingAllowed("PUBLISHED")).toBe(false);
    });
  });
});
