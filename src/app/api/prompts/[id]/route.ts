import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { generateUniqueSlug } from "@/lib/slugs";
import { z } from "zod";

const UpdatePromptSchema = z.object({
  title: z.string().min(2).optional(),
  originalPrompt: z.string().min(5).optional(),
  sourceImageUrl: z.string().url().optional().nullable(),
  sourceBlobPathname: z.string().optional().nullable(),
  sourceContentType: z.string().optional().nullable(),
  sourceImageSize: z.number().optional().nullable(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  slug: z.string().optional(),
  isArchived: z.boolean().optional(),

  // Optional Camera & Technical Metadata
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const prompt = await dbService.getPromptById(id);

  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: prompt });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = UpdatePromptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = { ...parsed.data };

    // If an explicit new slug was requested, ensure collision safety
    if (updateData.slug) {
      updateData.slug = await generateUniqueSlug(updateData.slug, id);
    }

    const updated = await dbService.updatePrompt(id, updateData);

    if (!updated) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const updated = await dbService.updatePrompt(id, { isArchived: true });

    if (!updated) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Prompt archived successfully", data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
