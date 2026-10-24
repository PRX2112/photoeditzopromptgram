import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { generateUniqueSlug } from "@/lib/slugs";
import { CreatePromptSchema } from "@/lib/validations/prompt";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const includeArchived = searchParams.get("includeArchived") === "true";
    const availableOnly = searchParams.get("availableOnly") === "true";

    if (availableOnly) {
      const available = await dbService.getAvailablePrompts();
      return NextResponse.json({ success: true, count: available.length, data: available });
    }

    const prompts = await dbService.getPrompts({ category, search, status, includeArchived });

    return NextResponse.json({ success: true, count: prompts.length, data: prompts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreatePromptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Generate collision-safe unique slug
    const finalSlug = await generateUniqueSlug(data.slug || data.title);

    const created = await dbService.createPrompt({
      title: data.title.trim(),
      originalPrompt: data.originalPrompt.trim(),
      slug: finalSlug,
      sourceImageUrl: data.sourceImageUrl,
      sourceBlobPathname: data.sourceBlobPathname || undefined,
      sourceContentType: data.sourceContentType || undefined,
      sourceImageSize: data.sourceImageSize || undefined,
      category: data.category?.trim() || "Uncategorized",
      tags: data.tags || [],
      cameraModel: data.cameraModel?.trim() || undefined,
      lens: data.lens?.trim() || undefined,
      focalLength: data.focalLength?.trim() || undefined,
      aperture: data.aperture?.trim() || undefined,
      shutterSpeed: data.shutterSpeed?.trim() || undefined,
      iso: data.iso?.trim() || undefined,
      lightingSetup: data.lightingSetup?.trim() || undefined,
      renderingEngine: data.renderingEngine?.trim() || undefined,
      generationSettings: data.generationSettings || undefined,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
