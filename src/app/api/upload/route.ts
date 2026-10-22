import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { storageService } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // Validate mime type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Supported formats: JPEG, PNG, WEBP." },
        { status: 400 }
      );
    }

    // Max size: 8MB
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image file exceeds maximum permitted size of 8MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await storageService.uploadTemporaryAsset(
      buffer,
      file.name,
      file.type,
      24 // 24 hours temporary retention
    );

    return NextResponse.json({
      success: true,
      publicUrl: result.publicUrl,
      assetKey: result.assetKey,
      filename: file.name,
      size: file.size,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
