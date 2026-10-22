import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { storageService } from "@/lib/storage";

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
    const allPosts = await dbService.getPosts();
    const post = allPosts.find((p) => p.id === id);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Mock/real publish
    const publishedMediaId = `1802${Date.now().toString().slice(-8)}`;
    const publishedPermalink = `https://www.instagram.com/p/C${Math.random().toString(36).substring(2, 8)}/`;

    const updated = await dbService.updatePost(id, {
      status: "PUBLISHED",
      publishedAt: new Date().toISOString(),
      instagramMediaId: publishedMediaId,
      instagramPermalink: publishedPermalink,
    });

    if (post.temporaryAssetKey) {
      await storageService.deleteTemporaryAsset(post.temporaryAssetKey);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
