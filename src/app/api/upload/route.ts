import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { vercelBlobService } from "@/lib/storage/vercel-blob";

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

    // Convert file to buffer for magic-byte content inspection
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Vercel Blob with magic byte validation and size check
    const blobResult = await vercelBlobService.uploadTemporaryImage(
      buffer,
      file.name,
      file.type
    );

    return NextResponse.json({
      success: true,
      publicUrl: blobResult.url,
      blobUrl: blobResult.url,
      pathname: blobResult.pathname,
      size: blobResult.size,
      contentType: blobResult.contentType,
      isVercelBlob: vercelBlobService.isConfigured(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
