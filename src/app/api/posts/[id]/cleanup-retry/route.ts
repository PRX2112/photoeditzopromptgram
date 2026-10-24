import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cleanupService } from "@/lib/storage/cleanup-published-image";

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
    const result = await cleanupService.cleanupPostImage(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Cleanup retry failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Temporary Blob image successfully purged.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
