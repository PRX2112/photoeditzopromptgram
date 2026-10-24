import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { geminiService } from "@/lib/gemini";
import { z } from "zod";

const InputSchema = z.object({
  originalPrompt: z.string().min(5, "Original prompt is required"),
  category: z.string().optional(),
  imageTitle: z.string().optional(),
  commentKeyword: z.string().min(1, "Comment keyword is required"),
  captionStyle: z.enum(["editorial", "storytelling", "minimalist", "technical"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = InputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await geminiService.generateCaption(parsed.data);

    return NextResponse.json({
      success: true,
      data: result,
      source: geminiService.isConfigured() ? "gemini-live" : "photographic-rules",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
