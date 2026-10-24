import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { GeminiCaptionGenerationInput, GeminiCaptionGenerationOutput } from "@/types";

export const GeminiOutputSchema = z.object({
  title: z.string().optional().default("Prompt Inspiration"),
  caption: z.string().min(10, "Caption must be descriptive"),
  hashtags: z.array(z.string()).default([]),
  commentKeyword: z.string().optional(),
  suggestedKeywords: z.array(z.string()).default([]),
  altText: z.string().optional().default("Photography prompt visual showcase"),
  confidenceNotes: z.string().optional(),
});

/**
 * Combines caption and hashtags cleanly for publication,
 * ensuring no duplicate hashtags and limiting total hashtags to at most 5.
 */
export function combineCaptionAndHashtags(
  caption: string,
  rawHashtags: string | string[]
): string {
  const cleanCaption = (caption || "").trim();

  // Find hashtags already written directly inside the caption text (case-insensitive)
  const existingTags = new Set(
    (cleanCaption.match(/#[a-zA-Z0-9_]+/g) || []).map((t) => t.toLowerCase())
  );

  // Normalize incoming hashtags
  const incomingList: string[] = Array.isArray(rawHashtags)
    ? rawHashtags
    : (rawHashtags || "").split(/[\s,]+/);

  const additionalTags: string[] = [];

  for (let tag of incomingList) {
    tag = tag.trim();
    if (!tag) continue;
    if (!tag.startsWith("#")) tag = `#${tag}`;
    const cleanTag = tag.replace(/[^a-zA-Z0-9_#]/g, "");
    if (cleanTag.length <= 1) continue;

    const lower = cleanTag.toLowerCase();
    if (!existingTags.has(lower)) {
      existingTags.add(lower);
      additionalTags.push(cleanTag);
    }

    if (existingTags.size >= 5) break;
  }

  if (additionalTags.length === 0) {
    return cleanCaption;
  }

  return `${cleanCaption}\n\n${additionalTags.join(" ")}`.trim();
}

/**
 * Validates and refines Gemini output according to strict CTA-first rules:
 * 1. Confirms the Primary CTA contains the configured comment keyword.
 * 2. Confirms the caption is within the ~40–70 word target, distilling if model generated an essay.
 * 3. Limits hashtags to at most 5 plain-text tags.
 * 4. Preserves the original prompt verbatim.
 */
export function validateAndCleanCaptionOutput(
  raw: {
    title?: string;
    caption: string;
    hashtags?: string[];
    commentKeyword?: string;
    suggestedKeywords?: string[];
    altText?: string;
    confidenceNotes?: string;
  },
  keyword: string,
  originalPrompt: string
): GeminiCaptionGenerationOutput {
  const upperKeyword = keyword.toUpperCase();
  let caption = raw.caption.trim();

  // 1. Confirm the CTA contains the configured keyword
  if (!caption.toUpperCase().includes(upperKeyword)) {
    // Inject the mandatory CTA immediately after the first hook line
    const ctaLine = `👇 Comment ${upperKeyword} to get the full photography prompt in your DMs!`;
    const paragraphs = caption.split("\n\n").filter(Boolean);
    if (paragraphs.length > 0) {
      paragraphs.splice(1, 0, ctaLine);
      caption = paragraphs.join("\n\n");
    } else {
      caption = `${caption}\n\n${ctaLine}`;
    }
  }

  // 2. Word count target check (target 40-70 words).
  // If the model produced a lengthy essay (>90 words), distill to Hook + CTA + Supporting line
  const words = caption.split(/\s+/).filter(Boolean);
  if (words.length > 90) {
    const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
    const hook = lines[0] || "Want to recreate this aesthetic look? 📸";
    const cta = `👇 Comment ${upperKeyword} to get the full photography prompt in your DMs!`;
    const lastLine =
      lines.length > 2 && !lines[lines.length - 1].toUpperCase().includes(upperKeyword)
        ? lines[lines.length - 1]
        : "Save this for your next creative shoot. ❤️";
    caption = `${hook}\n\n${cta}\n\n${lastLine}`;
  }

  // 3. Limit hashtags to at most 5 and normalize formatting
  const rawTags = Array.isArray(raw.hashtags) ? raw.hashtags : [];
  const cleanHashtags = rawTags
    .map((tag) => {
      const clean = tag.replace(/[^a-zA-Z0-9_#]/g, "");
      return clean.startsWith("#") ? clean : `#${clean}`;
    })
    .filter((tag) => tag.length > 1)
    .slice(0, 5);

  return {
    title: raw.title || "Prompt Inspiration",
    caption,
    hashtags: cleanHashtags,
    commentKeyword: upperKeyword,
    suggestedKeywords: raw.suggestedKeywords && raw.suggestedKeywords.length > 0
      ? Array.from(new Set([upperKeyword, ...raw.suggestedKeywords]))
      : [upperKeyword],
    altText: raw.altText || `Photography prompt showcase: ${originalPrompt.slice(0, 80)}`,
    confidenceNotes: raw.confidenceNotes,
  };
}

export const geminiService = {
  /**
   * Check if Gemini API key is configured
   */
  isConfigured: (): boolean => {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  },

  /**
   * Generate structured CTA-first photography caption, hashtags, and keywords
   */
  generateCaption: async (
    input: GeminiCaptionGenerationInput
  ): Promise<GeminiCaptionGenerationOutput> => {
    const apiKey = process.env.GEMINI_API_KEY;
    const keyword = (input.commentKeyword || "PROMPT").toUpperCase();

    // If Gemini API key is configured, call official Gemini API
    if (apiKey && apiKey.trim().length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const promptInstruction = `
You are an expert Instagram copywriter and social media strategist for an Instagram page dedicated to photography prompts and creator education.

OBJECTIVE:
Write a high-converting, CTA-first Instagram caption designed to drive comments for automated DM delivery.

INPUT DETAILS:
- Original Photography Prompt: "${input.originalPrompt}"
- Photography Category / Context: "${input.category || "Creative Photography"}"
- Title / Notes: "${input.imageTitle || "None provided"}"
- Target Comment Keyword: "${keyword}"

MANDATORY CAPTION STRUCTURE:
1. Short hook (Line 1): Exactly ONE engaging line related to the photograph, aesthetic look, or the benefit of the prompt. Use restrained emoji (e.g. 📸, ✨, 🎬).
2. Primary CTA (Line 2): Explicitly and immediately instruct users to comment the keyword to get the prompt:
   "👇 Comment ${keyword} to get the full photography prompt in your DMs!"
3. Optional supporting line (Line 3): At most ONE short sentence describing the vibe or telling users to save the post (e.g. "Save this for your next shoot. ❤️").

STRICT RULES:
- Target word count: 40–70 words (excluding hashtags). Keep it concise so followers see the CTA without needing to tap "...more".
- Place the exact configured comment keyword "${keyword}" right near the beginning of the caption (in the Primary CTA on Line 2).
- NEVER hardcode a generic keyword like STUDIO if the configured keyword is different. Use "${keyword}".
- Do NOT bury the CTA beneath paragraphs of editorial storytelling.
- Do NOT include lengthy descriptions of camera settings, lighting theory, sensor sizes, or film grain.
- Do NOT claim the DM contains camera settings, presets, or downloadable files. The DM contains the link to the full prompt.
- Avoid generic phrases such as "True editorial storytelling lives in the spaces between poses."
- Provide at most FIVE (5) relevant hashtags in the "hashtags" array. Do NOT return 10-15 hashtags.
- Do NOT format hashtags as Markdown links in the caption. Return normal Instagram-ready caption text.
- Never modify or rewrite the original photography prompt.

OUTPUT JSON SCHEMA:
Return ONLY a valid JSON object matching:
{
  "title": "Short evocative title (under 50 chars)",
  "caption": "Short engaging hook\\n\\n👇 Comment ${keyword} to get the full photography prompt in your DMs!\\n\\nSave this for your next shoot. ❤️",
  "hashtags": ["#PhotographyPrompts", "#PhotoInspo", "#PortraitPhotography", "#GoldenHour", "#CreativePhoto"],
  "commentKeyword": "${keyword}",
  "suggestedKeywords": ["${keyword}"],
  "altText": "Concise and accurate image description"
}
`;

        let response;
        const candidateModels = [
          "gemini-3.5-flash-lite",
          "gemini-flash-lite-latest",
          "gemini-3.1-flash-lite",
          "gemini-3.5-flash",
        ];
        let lastError: unknown;

        for (const candidate of candidateModels) {
          try {
            response = await ai.models.generateContent({
              model: candidate,
              contents: promptInstruction,
              config: {
                responseMimeType: "application/json",
              },
            });
            if (response && response.text) break;
          } catch (modelError) {
            lastError = modelError;
            continue;
          }
        }

        if (!response || !response.text) {
          throw lastError || new Error("Failed to generate content with available Gemini models");
        }

        const rawText = response.text?.trim() || "";
        const parsedJson = JSON.parse(rawText);
        const validated = GeminiOutputSchema.parse(parsedJson);

        return validateAndCleanCaptionOutput(validated, keyword, input.originalPrompt);
      } catch (geminiError: unknown) {
        console.warn("Gemini API call failed, falling back to curated photographic engine:", geminiError);
      }
    }

    // High-fidelity CTA-first fallback generator
    return geminiService.generatePhotographicFallback(input);
  },

  /**
   * Rule-based photographic caption generator for offline/unconfigured environments
   * Strictly follows the mandatory 1. Hook, 2. CTA with keyword, 3. Supporting line, 4. Max 5 hashtags
   */
  generatePhotographicFallback: (
    input: GeminiCaptionGenerationInput
  ): GeminiCaptionGenerationOutput => {
    const keyword = (input.commentKeyword || "PROMPT").toUpperCase();
    const cat = input.category || "Fine Art Photography";

    // 1. Short engaging hook (Line 1)
    const hooks: Record<string, string> = {
      "Wedding and bridal": "Want to capture timeless, romantic golden-hour bridal portraits like this? 📸",
      "Fashion and editorial": "Want to recreate this bold, high-fashion editorial look? ✨",
      "Cinematic portraits": "Looking to master this moody cinematic portrait look? 🎬",
      "Creative lighting": "Want to experiment with this dramatic creative lighting setup? 💡",
    };
    const hook = hooks[cat] || `Want to recreate this cinematic ${cat.toLowerCase()} shot? 📸`;

    // 2. Primary CTA (Line 2)
    const cta = `👇 Comment ${keyword} to get the full photography prompt in your DMs!`;

    // 3. Optional supporting line (Line 3)
    const supporting = "Save this for your next creative shoot. ❤️";

    // Combined caption: Hook + Primary CTA + Supporting line
    const caption = `${hook}\n\n${cta}\n\n${supporting}`;

    // Hashtags: Maximum 5 relevant tags
    const hashtagsMap: Record<string, string[]> = {
      "Wedding and bridal": [
        "#WeddingPhotography",
        "#BridalPortrait",
        "#WeddingInspo",
        "#PhotographyPrompts",
        "#GoldenHour",
      ],
      "Fashion and editorial": [
        "#FashionEditorial",
        "#EditorialPhotography",
        "#HighFashion",
        "#PhotographyPrompts",
        "#StudioPhotography",
      ],
      "Cinematic portraits": [
        "#CinematicPortraits",
        "#MoodyPortraits",
        "#PortraitPhotography",
        "#PhotographyPrompts",
        "#CinematicLighting",
      ],
      "Creative lighting": [
        "#CreativeLighting",
        "#Chiaroscuro",
        "#StudioLighting",
        "#PhotographyPrompts",
        "#PhotoInspiration",
      ],
    };

    const categoryTags = (
      hashtagsMap[cat] || [
        "#PhotographyPrompts",
        "#PhotoInspiration",
        "#PortraitPhotography",
        "#CreativePhotography",
        "#VisualStoryteller",
      ]
    ).slice(0, 5);

    const title = input.imageTitle || `${cat} Inspiration`;

    return {
      title,
      caption,
      hashtags: categoryTags,
      commentKeyword: keyword,
      suggestedKeywords: [keyword],
      altText: `Photography prompt study in ${cat} style: ${input.originalPrompt.slice(0, 80)}`,
      confidenceNotes: "Generated with CTA-first prompt delivery structure.",
    };
  },
};
