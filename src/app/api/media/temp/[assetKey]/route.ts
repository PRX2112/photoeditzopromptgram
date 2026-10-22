import { NextRequest, NextResponse } from "next/server";
import { storageService } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetKey: string }> }
) {
  const { assetKey } = await context.params;

  if (!assetKey) {
    return new NextResponse("Asset key required", { status: 400 });
  }

  const asset = storageService.getTemporaryAsset(assetKey);

  if (!asset) {
    return new NextResponse("Asset not found or expired", { status: 404 });
  }

  return new NextResponse(new Uint8Array(asset.data), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": asset.size.toString(),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
