import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  geminiAutopilotService,
  AUTOPILOT_THEMES,
} from "@/lib/gemini-autopilot";
import { dbService } from "@/lib/db-service";
import { vercelBlobService } from "@/lib/storage/vercel-blob";
import * as ffmpegModule from "@/lib/ffmpeg";
import { geminiService } from "@/lib/gemini";

describe("1-Click AI Studio Autopilot Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Preset Themes & Configuration", () => {
    it("defines valid autopilot themes for instant generation", () => {
      expect(AUTOPILOT_THEMES.length).toBeGreaterThan(3);
      for (const theme of AUTOPILOT_THEMES) {
        expect(theme.id).toBeDefined();
        expect(theme.label).toBeDefined();
        expect(typeof theme.id).toBe("string");
        expect(typeof theme.label).toBe("string");
      }
      expect(AUTOPILOT_THEMES.some((t) => t.id === "random")).toBe(true);
    });
  });

  describe("2. Photography Prompt Idea Generation", () => {
    it("generates structured photography prompt ideas with technical metadata", async () => {
      const idea = await geminiAutopilotService.generatePromptIdea("cinematic-portraits", "CINEMA");

      expect(idea).toBeDefined();
      expect(idea.title).toBeDefined();
      expect(typeof idea.title).toBe("string");
      expect(idea.title.length).toBeGreaterThan(5);

      expect(idea.originalPrompt).toBeDefined();
      expect(typeof idea.originalPrompt).toBe("string");
      expect(idea.originalPrompt.length).toBeGreaterThan(20);

      expect(idea.imagenPrompt).toBeDefined();
      expect(typeof idea.imagenPrompt).toBe("string");

      expect(idea.category).toBeDefined();
      expect(Array.isArray(idea.tags)).toBe(true);

      // Verify keyword handling
      expect(idea.suggestedKeyword).toBe("CINEMA");
    });

    it("dynamically forces custom configured keyword when supplied", async () => {
      const customKeywords = ["VINTAGE", "STUDIO2026", "GLAMOUR"];
      for (const kw of customKeywords) {
        const idea = await geminiAutopilotService.generatePromptIdea("random", kw);
        expect(idea.suggestedKeyword).toBe(kw);
      }
    });

    it("falls back to rich curated concepts when Gemini API is offline or returns error", async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      try {
        delete process.env.GEMINI_API_KEY; // Simulate offline/missing key

        const fallbackIdea = await geminiAutopilotService.generatePromptIdea("bridal-romance", "BRIDAL");
        expect(fallbackIdea).toBeDefined();
        expect(fallbackIdea.title).toBeDefined();
        expect(fallbackIdea.originalPrompt).toBeDefined();
        expect(fallbackIdea.suggestedKeyword).toBe("BRIDAL");
      } finally {
        process.env.GEMINI_API_KEY = originalKey;
      }
    });
  });

  describe("3. Imagen 3 Photorealistic Image Generation", () => {
    it("returns a valid JPEG image buffer for photography concepts", async () => {
      const result = await geminiAutopilotService.generateImageWithImagen(
        "Photorealistic 85mm portrait of an artist in studio",
        "Studio Artist Portrait",
        "Cinematic portraits"
      );

      expect(result).toBeDefined();
      expect(result.mimeType).toBe("image/jpeg");
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(100);

      // Verify JPEG magic bytes (FF D8 FF)
      expect(result.buffer[0]).toBe(0xff);
      expect(result.buffer[1]).toBe(0xd8);
      expect(result.buffer[2]).toBe(0xff);
    });
  });

  describe("4. Complete 1-Click Autopilot Loop Execution", () => {
    it("orchestrates prompt generation, blob storage, db persistence, ffmpeg rendering, and draft creation", async () => {
      // Mock dbService, vercelBlobService, and ffmpeg
      const mockUpload = vi.spyOn(vercelBlobService, "uploadTemporaryImage").mockResolvedValue({
        url: "https://store.public.blob.vercel-storage.com/temp-uploads/autopilot-test.jpg",
        pathname: "temp-uploads/autopilot-test.jpg",
        contentType: "image/jpeg",
        size: 250000,
      });

      const mockCreatePrompt = vi.spyOn(dbService, "createPrompt").mockResolvedValue({
        id: "prompt-autopilot-123",
        title: "Golden Hour Tuscan Vineyard Bridal Whisper",
        originalPrompt: "Bridal portrait of a radiant bride amidst sun-drenched Tuscan vineyard hills at sunset...",
        slug: "golden-hour-tuscan-vineyard-bridal-whisper",
        category: "Wedding and bridal",
        tags: ["bridal", "wedding"],
        sourceImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/autopilot-test.jpg",
        sourceBlobPathname: "temp-uploads/autopilot-test.jpg",
        sourceContentType: "image/jpeg",
        sourceImageSize: 250000,
        published: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const mockRender = vi.spyOn(ffmpegModule, "renderInstagramImage").mockResolvedValue({
        renderedBlobUrl: "https://store.public.blob.vercel-storage.com/rendered/rendered-autopilot.jpg",
        renderedBlobPathname: "rendered/rendered-autopilot.jpg",
        width: 1080,
        height: 1350,
        size: 245000,
        contentType: "image/jpeg",
      });

      const mockCreatePost = vi.spyOn(dbService, "createPost").mockResolvedValue({
        id: "post-autopilot-456",
        promptId: "prompt-autopilot-123",
        caption: "Want to recreate this cinematic look? 👇 Comment BRIDAL to get the full prompt!",
        hashtags: "#Bridal #Photography #Wedding",
        commentKeyword: "BRIDAL",
        mediaType: "IMAGE",
        renderedImageUrl: "https://store.public.blob.vercel-storage.com/rendered/rendered-autopilot.jpg",
        renderedBlobPathname: "rendered/rendered-autopilot.jpg",
        blobUrl: "https://store.public.blob.vercel-storage.com/rendered/rendered-autopilot.jpg",
        blobPathname: "rendered/rendered-autopilot.jpg",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await geminiAutopilotService.executeOneClickAutopilot({
        theme: "bridal-romance",
        commentKeyword: "BRIDAL",
        instagramHandle: "@prx_dev",
        autoPublish: false,
      });

      expect(result.success).toBe(true);
      expect(result.prompt.id).toBe("prompt-autopilot-123");
      expect(result.prompt.slug).toBe("golden-hour-tuscan-vineyard-bridal-whisper");
      expect(result.prompt.publicUrl).toBe("/p/golden-hour-tuscan-vineyard-bridal-whisper");
      expect(result.post.id).toBe("post-autopilot-456");
      expect(result.post.status).toBe("DRAFT");
      expect(result.post.commentKeyword).toBe("BRIDAL");
      expect(result.redirectUrl).toBe("/composer?promptId=prompt-autopilot-123");

      expect(mockUpload).toHaveBeenCalled();
      expect(mockCreatePrompt).toHaveBeenCalled();
      expect(mockRender).toHaveBeenCalled();
      expect(mockCreatePost).toHaveBeenCalled();
    });

    it("formats redirect and post attributes correctly when autoPublish is enabled", async () => {
      vi.spyOn(vercelBlobService, "uploadTemporaryImage").mockResolvedValue({
        url: "https://store.public.blob.vercel-storage.com/temp-uploads/autopilot-test.jpg",
        pathname: "temp-uploads/autopilot-test.jpg",
        contentType: "image/jpeg",
        size: 250000,
      });

      vi.spyOn(dbService, "createPrompt").mockResolvedValue({
        id: "prompt-autopilot-pub",
        title: "Avant-Garde High-Fashion",
        originalPrompt: "High-fashion studio portrait...",
        slug: "avant-garde-high-fashion",
        category: "Fashion and editorial",
        tags: ["fashion"],
        sourceImageUrl: "https://store.public.blob.vercel-storage.com/temp-uploads/autopilot-test.jpg",
        sourceBlobPathname: "temp-uploads/autopilot-test.jpg",
        sourceContentType: "image/jpeg",
        sourceImageSize: 250000,
        published: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(ffmpegModule, "renderInstagramImage").mockResolvedValue({
        renderedBlobUrl: "https://store.public.blob.vercel-storage.com/rendered/rendered-autopilot.jpg",
        renderedBlobPathname: "rendered/rendered-autopilot.jpg",
        width: 1080,
        height: 1350,
        size: 245000,
        contentType: "image/jpeg",
      });

      vi.spyOn(dbService, "createPost").mockResolvedValue({
        id: "post-autopilot-pub",
        promptId: "prompt-autopilot-pub",
        caption: "Comment COUTURE to get the prompt!",
        hashtags: "#Fashion #Editorial",
        commentKeyword: "COUTURE",
        mediaType: "IMAGE",
        renderedImageUrl: "https://store.public.blob.vercel-storage.com/rendered/rendered-autopilot.jpg",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await geminiAutopilotService.executeOneClickAutopilot({
        theme: "haute-couture",
        commentKeyword: "COUTURE",
        autoPublish: true,
      });

      expect(result.success).toBe(true);
      expect(result.prompt.id).toBe("prompt-autopilot-pub");
      expect(result.post.commentKeyword).toBe("COUTURE");
    });
  });
});
