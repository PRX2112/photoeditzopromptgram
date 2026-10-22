import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { slugify } from "@/lib/utils";
import { z } from "zod";

const CreatePromptSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  originalPrompt: z.string().min(10, "Original prompt must be descriptive"),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).default([]),
  generationSettings: z.record(z.string(), z.any()).optional(),
  slug: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;
    const includeArchived = searchParams.get("includeArchived") === "true";

    const prompts = await dbService.getPrompts({ category, search, includeArchived });

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

    const { title, originalPrompt, category, tags, generationSettings } = parsed.data;

    let targetSlug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(title);
    if (!targetSlug) {
      targetSlug = `prompt-${Date.now()}`;
    }

    // Check slug collision
    const existing = await dbService.getPromptBySlug(targetSlug);
    if (existing) {
      targetSlug = `${targetSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const created = await dbService.createPrompt({
      title,
      originalPrompt,
      category,
      tags,
      generationSettings,
      slug: targetSlug,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
