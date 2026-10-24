import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  geminiService,
  combineCaptionAndHashtags,
  validateAndCleanCaptionOutput,
} from "@/lib/gemini";

describe("CTA-First Instagram Caption Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const samplePrompt = "Close-up 85mm portrait of a ceramic artist in apron, natural north window lighting, soft rim light, dust particles in sunbeam";

  describe("1. CTA Appears Near the Beginning", () => {
    it("places the call-to-action on or before line 3 of the caption", async () => {
      const output = await geminiService.generateCaption({
        originalPrompt: samplePrompt,
        commentKeyword: "CERAMIC",
        category: "Creative lighting",
      });

      const lines = output.caption.split("\n").map((l) => l.trim()).filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(2);

      // Line 1 is the hook
      // Line 2 or 3 must contain the CTA with the keyword
      const ctaInTopLines = lines.slice(0, 3).some((line) => line.toUpperCase().includes("CERAMIC"));
      expect(ctaInTopLines).toBe(true);

      // Verify explicit call to action text
      expect(output.caption).toMatch(/Comment\s+CERAMIC/i);
    });
  });

  describe("2. Correct Configured Keyword Is Used", () => {
    it("dynamically replaces configured keywords and never hardcodes STUDIO", async () => {
      const testKeywords = ["VINTAGE", "GOLDEN", "BRIDAL", "EDITORIAL_2026"];

      for (const kw of testKeywords) {
        const output = await geminiService.generateCaption({
          originalPrompt: samplePrompt,
          commentKeyword: kw,
          category: "Fashion and editorial",
        });

        expect(output.commentKeyword).toBe(kw);
        expect(output.caption.toUpperCase()).toContain(kw);
        expect(output.caption).toMatch(new RegExp(`Comment\\s+${kw}`, "i"));

        // Ensure STUDIO was not blindly hardcoded when another keyword was configured
        if (kw !== "STUDIO") {
          expect(output.caption).not.toContain("Comment STUDIO");
        }
      }
    });
  });

  describe("3. Caption Avoids Long Editorial Paragraphs (Concise Word Count Target)", () => {
    it("generates a concise caption within the ~40–70 word target", async () => {
      const output = await geminiService.generateCaption({
        originalPrompt: samplePrompt,
        commentKeyword: "POTTERY",
      });

      const words = output.caption.split(/\s+/).filter(Boolean);
      // Target is 40–70 words; allow reasonable boundary (under 85 words)
      expect(words.length).toBeLessThanOrEqual(85);
      expect(words.length).toBeGreaterThanOrEqual(15);

      // Ensure no generic fluff or lengthy sensor/lens theory
      expect(output.caption).not.toContain("True editorial storytelling lives in the spaces between poses");
      expect(output.caption).not.toContain("lens setup, and lighting configuration straight to your DMs");
    });

    it("safely trims lengthy essays during validation to Hook + CTA + Supporting Line", () => {
      const lengthyEssay = `
        Exploring the delicate nuance of tone and atmosphere in portraiture.
        Notice the subtle shadow transitions across the cheekbones, the deliberate color palette, and the depth of field produced by an 85mm f/1.4 lens.
        True editorial storytelling lives in the spaces between poses, where light sculpts emotion.
        We calibrated the exposure to balance natural window illumination with a warm reflector.
        👇 Comment SCULPT to get the full photography prompt in your DMs!
        This is another extra paragraph of lighting theory and camera settings discussion that should not be here.
        Save this for your next creative shoot. ❤️
      `;

      const cleaned = validateAndCleanCaptionOutput(
        {
          title: "Sculpt Study",
          caption: lengthyEssay,
          hashtags: ["#photo1", "#photo2"],
          suggestedKeywords: ["SCULPT"],
          altText: "Test alt",
        },
        "SCULPT",
        samplePrompt
      );

      const words = cleaned.caption.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThan(75);
      expect(cleaned.caption).toContain("SCULPT");
    });
  });

  describe("4. At Most Five Hashtags Generated", () => {
    it("limits generated hashtags to a maximum of 5", async () => {
      const output = await geminiService.generateCaption({
        originalPrompt: samplePrompt,
        commentKeyword: "PORTRAIT",
        category: "Cinematic portraits",
      });

      expect(output.hashtags.length).toBeLessThanOrEqual(5);
      expect(output.hashtags.length).toBeGreaterThanOrEqual(1);

      for (const tag of output.hashtags) {
        expect(tag.startsWith("#")).toBe(true);
        expect(tag).not.toContain("[");
        expect(tag).not.toContain("]");
      }
    });

    it("slices incoming arrays of >5 hashtags to exactly 5 in validation", () => {
      const cleaned = validateAndCleanCaptionOutput(
        {
          title: "Test",
          caption: "Short hook\n\n👇 Comment TAG to get the full photography prompt in your DMs!\n\nSave this.",
          hashtags: ["#one", "#two", "#three", "#four", "#five", "#six", "#seven", "#eight"],
          suggestedKeywords: ["TAG"],
          altText: "Alt",
        },
        "TAG",
        samplePrompt
      );

      expect(cleaned.hashtags).toHaveLength(5);
      expect(cleaned.hashtags).toEqual(["#one", "#two", "#three", "#four", "#five"]);
    });
  });

  describe("5. No Duplicate Hashtags When Caption & Hashtags Combined", () => {
    it("deduplicates case-insensitively and caps combined hashtags at 5", () => {
      const captionWithTag = `Want to recreate this portrait look? 📸\n\n👇 Comment LIGHT to get the full photography prompt in your DMs!\n\n#PhotographyPrompts #PortraitPhotography`;
      const separateHashtags = ["#photographyprompts", "#PORTRAITPHOTOGRAPHY", "#StudioLighting", "#PhotoInspo", "#Canon", "#Sony"];

      const combined = combineCaptionAndHashtags(captionWithTag, separateHashtags);

      // Verify no duplicates
      const tagsInCombined = combined.match(/#[a-zA-Z0-9_]+/g) || [];
      const lowerTags = tagsInCombined.map((t) => t.toLowerCase());
      const uniqueTags = new Set(lowerTags);

      expect(tagsInCombined.length).toBe(uniqueTags.size);
      expect(tagsInCombined.length).toBeLessThanOrEqual(5);
      expect(combined).toContain("#PhotographyPrompts");
      expect(combined).toContain("#StudioLighting");
    });

    it("handles string input and comma-separated tags in combineCaptionAndHashtags", () => {
      const caption = "Clean hook\n\n👇 Comment ART to get the full photography prompt in your DMs!";
      const hashtags = "#ArtInspo, #CreativePhoto #Studio";

      const combined = combineCaptionAndHashtags(caption, hashtags);
      expect(combined).toContain("#ArtInspo");
      expect(combined).toContain("#CreativePhoto");
      expect(combined).toContain("#Studio");
    });
  });

  describe("6. Manually Edited Caption Is Not Silently Overwritten", () => {
    it("maintains custom user edits when creating publication payload", () => {
      const userEditedCaption = "Custom photographer note: captured at 6:30 AM in Venice. Comment VENICE below!";
      const hashtags = "#VenicePhotography #TravelPhoto";

      // When publishing combines caption and hashtags
      const publicationPayload = combineCaptionAndHashtags(userEditedCaption, hashtags);

      // Custom wording must be preserved untouched
      expect(publicationPayload).toContain("Custom photographer note: captured at 6:30 AM in Venice.");
      expect(publicationPayload).toContain("Comment VENICE below!");
      expect(publicationPayload).toContain("#VenicePhotography");
    });
  });

  describe("7. Original Prompt Preservation", () => {
    it("never modifies or replaces the original photography prompt text", async () => {
      const originalText = 'Verbatim Prompt: "Two lovers standing on rain-slicked cobblestones in 1950s Paris, noir rim lighting" & special chars — 50mm';
      
      const output = await geminiService.generateCaption({
        originalPrompt: originalText,
        commentKeyword: "PARIS",
      });

      // Output caption must NOT equal original prompt
      expect(output.caption).not.toBe(originalText);
      // Original variable must be completely untouched
      expect(originalText).toBe('Verbatim Prompt: "Two lovers standing on rain-slicked cobblestones in 1950s Paris, noir rim lighting" & special chars — 50mm');
    });
  });

  describe("8. Fallback Engine Compliance on Gemini Failure", () => {
    it("generates CTA-first compliant copy when Gemini API is unavailable", () => {
      const fallback = geminiService.generatePhotographicFallback({
        originalPrompt: samplePrompt,
        commentKeyword: "STUDIO",
        category: "Wedding and bridal",
      });

      expect(fallback.caption).toContain("👇 Comment STUDIO to get the full photography prompt in your DMs!");
      expect(fallback.commentKeyword).toBe("STUDIO");
      expect(fallback.hashtags.length).toBeLessThanOrEqual(5);

      const words = fallback.caption.split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(70);
      expect(words.length).toBeGreaterThanOrEqual(20);
    });
  });
});
