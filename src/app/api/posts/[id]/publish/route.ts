import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { instagramPublishingService } from "@/lib/instagram/publishing";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const result = await instagramPublishingService.publishPost(id, "manual-publish-api");

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Publication failed",
          isAmbiguous: result.isAmbiguous,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      mediaId: result.mediaId,
      permalink: result.permalink,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
