import { z } from "zod";

export const CreatePromptSchema = z.object({
  title: z.string().min(2, "Title is required"),
  originalPrompt: z.string().min(5, "Original prompt is required and must be verbatim"),
  sourceImageUrl: z.string().url("A valid source image URL is required"),
  sourceBlobPathname: z.string().optional().nullable(),
  sourceContentType: z.string().optional().nullable(),
  sourceImageSize: z.number().optional().nullable(),
  category: z.string().optional().default("Uncategorized"),
  tags: z.array(z.string()).optional().default([]),
  slug: z.string().optional().nullable(),

  // Optional Camera & Technical Metadata (May be omitted)
  cameraModel: z.string().optional().nullable(),
  lens: z.string().optional().nullable(),
  focalLength: z.string().optional().nullable(),
  aperture: z.string().optional().nullable(),
  shutterSpeed: z.string().optional().nullable(),
  iso: z.string().optional().nullable(),
  lightingSetup: z.string().optional().nullable(),
  renderingEngine: z.string().optional().nullable(),
  generationSettings: z.record(z.string(), z.any()).optional().nullable(),
});

export const UpdatePromptSchema = CreatePromptSchema.partial().extend({
  id: z.string().optional(),
});
