import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { GeminiCaptionGenerationInput, GeminiCaptionGenerationOutput } from "@/types";

export const GeminiOutputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  caption: z.string().min(10, "Caption must be descriptive"),
  hashtags: z.array(z.string()).min(3, "At least 3 hashtags required"),
  suggestedKeywords: z.array(z.string()).min(1, "At least 1 keyword suggested"),
  altText: z.string().min(10, "Accessible alt text required"),
  confidenceNotes: z.string().optional(),
});

export const geminiService = {
  /**
   * Check if Gemini API key is configured
   */
  isConfigured: (): boolean => {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  },

  /**
   * Generate structured photography caption, hashtags, and keywords
   */
  generateCaption: async (
    input: GeminiCaptionGenerationInput
  ): Promise<GeminiCaptionGenerationOutput> => {
    const apiKey = process.env.GEMINI_API_KEY;
    const keyword = (input.commentKeyword || "PROMPT").toUpperCase();
    const style = input.captionStyle || "editorial";

    // If Gemini API key is configured, call official Gemini API
    if (apiKey && apiKey.trim().length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const promptInstruction = `
You are a senior photography curator, art director, and social media copywriter for an Instagram page dedicated to photography inspiration, lighting setups, and AI image prompts.

INPUT DETAILS:
- Original Prompt: "${input.originalPrompt}"
- Photography Category: "${input.category}"
- Notes / Context: "${input.imageTitle || "None provided"}"
- Target Comment Keyword: "${keyword}"
- Desired Caption Style: "${style}"

RULES:
1. Do NOT modify the original prompt. The user needs the original prompt preserved verbatim.
2. The caption must sound authentic, editorial, and inspiring to real photographers (focusing on light quality, texture, color grading, emotion, and compositional balance).
3. The caption MUST include a natural call-to-action inviting followers to comment the keyword "${keyword}" to receive the full prompt in their DMs (e.g. "Comment ${keyword} to receive the full prompt, lighting notes, and camera settings directly in your DMs.").
4. Format hashtags with leading '#' symbols (provide 8-15 high-intent photography hashtags).
5. Suggest 3-5 punchy 1-word comment keywords (all UPPERCASE) relevant to this specific theme.
6. Provide rich, accessible altText for screen readers and search algorithms.
7. Return ONLY a single raw JSON object matching this exact schema:
{
  "title": "Short evocative title (under 60 chars)",
  "caption": "Full Instagram caption with line breaks and call to action",
  "hashtags": ["#weddingphotography", "#goldenhour", ...],
  "suggestedKeywords": ["${keyword}", "LIGHT", "PRESET", "CAMERA"],
  "altText": "Detailed descriptive alt text of the photographic subject and lighting",
  "confidenceNotes": "Notes on stylistic choices"
}
`;

        let response;
        const candidateModels = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
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

        return validated;
      } catch (geminiError: unknown) {
        console.warn("Gemini API call failed, falling back to curated photographic engine:", geminiError);
        // Fall back to rule-based photographer generator if API quota or connection fails
      }
    }

    // High-fidelity photography generator fallback
    return geminiService.generatePhotographicFallback(input);
  },

  /**
   * Rule-based photographic caption generator for offline/unconfigured environments
   */
  generatePhotographicFallback: (
    input: GeminiCaptionGenerationInput
  ): GeminiCaptionGenerationOutput => {
    const keyword = (input.commentKeyword || "PROMPT").toUpperCase();
    const cat = input.category;

    const stylePrefixes: Record<string, string> = {
      editorial: "Where geometry meets intentional light. Exploring the delicate nuance of tone and atmosphere.",
      storytelling: "Every frame carries a narrative whispered in shadows and sculpted by time.",
      minimalist: "Distilled to essence. Clean negative space, precise texture, and honest lighting.",
      technical: "Calibrated color harmony, balanced exposure, and sculpted rim illumination.",
    };

    const prefix = stylePrefixes[input.captionStyle || "editorial"] || stylePrefixes.editorial;

    const hashtagsMap: Record<string, string[]> = {
      "Wedding and bridal": [
        "#weddingphotography",
        "#bridalportrait",
        "#goldenhourwedding",
        "#weddingphotographer",
        "#fineartwedding",
        "#weddingeditorial",
        "#destinationwedding",
        "#portraitlighting",
      ],
      "Fashion and editorial": [
        "#fashioneditorial",
        "#editorialphotography",
        "#vogueitalia",
        "#highfashion",
        "#fashionphotographer",
        "#editorialshoot",
        "#studioeditorial",
        "#fashionlighting",
      ],
      "Cinematic portraits": [
        "#cinematicportrait",
        "#anamorphic",
        "#moodyportraits",
        "#cinematography",
        "#storyportrait",
        "#cinematiclighting",
        "#filmgrain",
        "#directorofphotography",
      ],
      "Creative lighting": [
        "#creativelighting",
        "#chiaroscuro",
        "#prismphotography",
        "#studiolighting",
        "#rembrandtlighting",
        "#opticaleffects",
        "#shadowplay",
      ],
    };

    const categoryTags =
      hashtagsMap[cat] || [
        "#photographyinspiration",
        "#photographylife",
        "#portraitphotography",
        "#naturallightphotography",
        "#visualstoryteller",
        "#cameraandlens",
      ];

    const title = input.imageTitle || `${cat} Study`;

    const caption = `${prefix}\n\nA masterclass in ${cat.toLowerCase()}. Notice the depth of field, subtle shadow transitions, and intentional color palette.\n\nComment "${keyword}" below and I'll send the full prompt, lens setup, and lighting configuration straight to your DMs.`;

    const suggestedKeywords = [
      keyword,
      cat.split(" ")[0].toUpperCase(),
      "SETTINGS",
      "PROMPT",
    ];

    return {
      title,
      caption,
      hashtags: categoryTags,
      suggestedKeywords,
      altText: `Photographic study in ${cat} style featuring ${input.originalPrompt.slice(0, 100)}...`,
      confidenceNotes: "Generated with photographic style guidelines.",
    };
  },
};
