import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renderInstagramImage } from "@/lib/ffmpeg";
import { dbService } from "@/lib/db-service";

const RenderImageSchema = z.object({
  sourceImageUrl: z.string().url("A valid image URL is required"),
  title: z.string().min(1, "Title is required"),
  instagramHandle: z.string().optional(),
  commentKeyword: z.string().optional(),
  ctaText: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RenderImageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { sourceImageUrl, title, instagramHandle, commentKeyword, ctaText } = parsed.data;

    // Resolve handle from active Instagram account if not provided
    let handle = instagramHandle;
    if (!handle) {
      try {
        const account = await dbService.getConnectedInstagramAccount();
        if (account?.username) {
          handle = `@${account.username}`;
        }
      } catch {
        handle = "@prx_dev";
      }
    }

    const result = await renderInstagramImage({
      sourceImageUrlOrPath: sourceImageUrl,
      title,
      instagramHandle: handle,
      commentKeyword,
      ctaText,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to render image with FFmpeg";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
