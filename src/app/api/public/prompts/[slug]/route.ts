import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/db-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "copy";

    if (action === "copy") {
      await dbService.incrementPromptCopies(slug);
    } else {
      await dbService.incrementPromptViews(slug);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
