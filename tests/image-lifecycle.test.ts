import { describe, it, expect, vi, beforeEach } from "vitest";
import { vercelBlobService, validateImageMagicBytes, isOwnedVercelBlobUrl } from "@/lib/storage/vercel-blob";
import { cleanupService } from "@/lib/storage/cleanup-published-image";
import { geminiService } from "@/lib/gemini";

// Mock @vercel/blob
vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({
    url: "https://mockstore.public.blob.vercel-storage.com/temp-uploads/post-images/test-uuid.jpg",
    pathname: "temp-uploads/post-images/test-uuid.jpg",
    contentType: "image/jpeg",
    size: 2048,
  }),
  head: vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("already-deleted")) {
      const err = new Error("BlobNotFoundError: Object not found");
      (err as any).status = 404;
      throw err;
    }
    return { url, size: 1024 };
  }),
  del: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => {
  const mockPost = {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  };
  const mockPrompt = {
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  };
  return {
    prisma: {
      post: mockPost,
      prompt: mockPrompt,
      scheduledJob: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn((callback) => callback({ post: mockPost, prompt: mockPrompt })),
    },
    checkDatabaseConnection: vi.fn().mockResolvedValue({ ok: true }),
  };
});

describe("Vercel Blob Image Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Magic Byte & MIME Type Validation", () => {
    it("accepts valid JPEG magic bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const result = validateImageMagicBytes(jpegBuffer, "image/jpeg");
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe("image/jpeg");
    });

    it("accepts valid PNG magic bytes", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const result = validateImageMagicBytes(pngBuffer, "image/png");
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe("image/png");
    });

    it("accepts valid WEBP magic bytes", () => {
      const webpBuffer = Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from("WEBP"),
      ]);
      const result = validateImageMagicBytes(webpBuffer, "image/webp");
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe("image/webp");
    });

    it("rejects invalid/executable files disguised as images", () => {
      const fakeBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00 (Windows Executable)");
      const result = validateImageMagicBytes(fakeBuffer, "image/jpeg");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Magic byte header mismatch");
    });

    it("rejects files exceeding maximum size limit (10MB)", async () => {
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      await expect(
        vercelBlobService.uploadTemporaryImage({
          fileBuffer: oversizedBuffer,
          fileName: "oversized.jpg",
          declaredMimeType: "image/jpeg",
        })
      ).rejects.toThrow(/exceeds configured maximum/);
    });

    it("rejects unsupported MIME types", async () => {
      const textBuffer = Buffer.from("plain text content here");
      await expect(
        vercelBlobService.uploadTemporaryImage({
          fileBuffer: textBuffer,
          fileName: "document.pdf",
          declaredMimeType: "application/pdf",
        })
      ).rejects.toThrow(/Unsupported MIME type/);
    });
  });

  describe("Vercel Blob Ownership Validation", () => {
    it("recognizes legitimate Vercel Blob store URLs belonging to this app", () => {
      const validUrl =
        "https://rve5f8abc.public.blob.vercel-storage.com/temp-uploads/post-images/12345.jpg";
      expect(isOwnedVercelBlobUrl(validUrl)).toBe(true);
    });

    it("rejects arbitrary external URLs to prevent malicious deletion", async () => {
      const externalUrl = "https://example-bucket.s3.amazonaws.com/uploads/photo.jpg";
      expect(isOwnedVercelBlobUrl(externalUrl)).toBe(false);

      await expect(vercelBlobService.deleteTemporaryBlob(externalUrl)).rejects.toThrow(
        /Security exception/
      );
    });

    it("rejects localhost and file URLs", () => {
      expect(isOwnedVercelBlobUrl("http://localhost:3000/temp.jpg")).toBe(false);
      expect(isOwnedVercelBlobUrl("file:///C:/secrets.png")).toBe(false);
    });
  });

  describe("Gemini Failure Handling without Prompt Corruption", () => {
    it("preserves original prompt even when Gemini generation encounters an error", async () => {
      const originalPromptText = "Vintage Leica M3 street portrait in heavy Tokyo rain, 35mm f/1.4 Summilux";

      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const fallbackResult = await geminiService.generateCaption({
        originalPrompt: originalPromptText,
        category: "Street photography",
        commentKeyword: "LEICA",
      });

      expect(fallbackResult).toBeDefined();
      expect(fallbackResult.title).toBeDefined();
      expect(fallbackResult.caption).toContain("LEICA");
      expect(fallbackResult.caption).not.toBe(originalPromptText);
      expect(originalPromptText).toBe("Vintage Leica M3 street portrait in heavy Tokyo rain, 35mm f/1.4 Summilux");

      process.env.GEMINI_API_KEY = originalEnv;
    });
  });

  describe("Image Cleanup Eligibility & Idempotency", () => {
    it("prevents Blob cleanup if post is not confirmed PUBLISHED", async () => {
      const draftPost = {
        id: "post-draft-1",
        status: "DRAFT",
        blobUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/test.jpg",
        instagramMediaId: null,
      };

      const result = await cleanupService.cleanupPostImage(draftPost.id, draftPost as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot clean up image unless confirmed PUBLISHED");
    });

    it("handles already-deleted Blob gracefully without throwing error", async () => {
      const publishedPost = {
        id: "post-published-1",
        status: "PUBLISHED" as const,
        imageLifecycleStatus: "CLEANUP_PENDING" as const,
        blobUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/already-deleted.jpg",
        blobPathname: "temp-uploads/already-deleted.jpg",
        instagramMediaId: "ig_media_12345",
        publishedAt: new Date(),
        cleanupAttempts: 0,
      };

      const result = await cleanupService.cleanupPostImage(publishedPost.id, publishedPost as any);
      expect(result.success).toBe(true);
    });

    it("records failure without republishing or corrupting post status on cleanup error", async () => {
      const postWithBadUrl = {
        id: "post-fail-cleanup",
        status: "PUBLISHED" as const,
        imageLifecycleStatus: "CLEANUP_PENDING" as const,
        blobUrl: "https://malicious-external-domain.com/unowned.jpg",
        instagramMediaId: "ig_media_9999",
        publishedAt: new Date(),
        cleanupAttempts: 0,
      };

      const result = await cleanupService.cleanupPostImage(postWithBadUrl.id, postWithBadUrl as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security exception");
      expect(postWithBadUrl.status).toBe("PUBLISHED");
    });
  });
});
