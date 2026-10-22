import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { instagramService } from "@/lib/instagram";
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

    if (!post.temporaryImageUrl) {
      return NextResponse.json(
        { error: "Post does not have an associated image URL to publish." },
        { status: 400 }
      );
    }

    if (!instagramService.isConfigured()) {
      return NextResponse.json(
        { error: "Meta Instagram API credentials (META_APP_ID, META_APP_SECRET) are not configured." },
        { status: 400 }
      );
    }

    const connectedAccount = await dbService.getConnectedInstagramAccount();
    if (!connectedAccount) {
      return NextResponse.json(
        {
          error:
            "No connected Instagram Professional account found. Please connect an account in Settings before publishing.",
        },
        { status: 400 }
      );
    }

    if (!connectedAccount.accessTokenEncrypted) {
      return NextResponse.json(
        { error: "Connected Instagram account is missing an access token." },
        { status: 400 }
      );
    }

    const fullCaption = `${post.caption}\n\n${post.hashtags}`.trim();
    const publishResult = await instagramService.publishImagePost(
      connectedAccount.accessTokenEncrypted,
      connectedAccount.igUserId,
      post.temporaryImageUrl,
      fullCaption
    );

    if (!publishResult.success || !publishResult.mediaId) {
      // Record failure on the post
      await dbService.updatePost(id, {
        status: "FAILED",
        errorMessage: publishResult.error || "Meta Instagram publish failed",
      });

      return NextResponse.json(
        { error: `Instagram publish failed: ${publishResult.error || "No media ID returned"}` },
        { status: 502 }
      );
    }

    if (post.temporaryAssetKey) {
      await storageService.deleteTemporaryAsset(post.temporaryAssetKey);
    }

    const updated = await dbService.updatePost(id, {
      status: "PUBLISHED",
      publishedAt: new Date().toISOString(),
      instagramMediaId: publishResult.mediaId,
      instagramPermalink: publishResult.permalink || null,
      errorMessage: null,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
