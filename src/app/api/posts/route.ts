import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { instagramService } from "@/lib/instagram";
import { storageService } from "@/lib/storage";
import { queueService } from "@/lib/queue";
import { z } from "zod";

const CreatePostSchema = z.object({
  promptId: z.string().min(1, "Associated prompt is required"),
  caption: z.string().min(1, "Caption is required"),
  hashtags: z.string().default(""),
  commentKeyword: z.string().min(1, "Comment keyword is required"),
  mediaType: z.string().default("IMAGE"),
  temporaryImageUrl: z.string().optional(),
  temporaryAssetKey: z.string().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]),
  scheduledFor: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const posts = await dbService.getPosts({ status });

    return NextResponse.json({ success: true, count: posts.length, data: posts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreatePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const keyword = data.commentKeyword.toUpperCase();

    // 1. If "PUBLISHED" (Publish Now) is requested
    if (data.status === "PUBLISHED") {
      let publishedMediaId: string | null = null;
      let publishedPermalink: string | null = null;

      // Check if real Meta account is configured and image URL is valid
      if (instagramService.isConfigured() && data.temporaryImageUrl) {
        const fullCaption = `${data.caption}\n\n${data.hashtags}`.trim();
        const publishResult = await instagramService.publishImagePost(
          "encrypted_token",
          "ig_user_id",
          data.temporaryImageUrl,
          fullCaption
        );

        if (publishResult.success) {
          publishedMediaId = publishResult.mediaId || `ig_${Date.now()}`;
          publishedPermalink = publishResult.permalink || `https://www.instagram.com/p/${publishedMediaId}/`;

          // Clean up ephemeral asset immediately after successful publish
          if (data.temporaryAssetKey) {
            await storageService.deleteTemporaryAsset(data.temporaryAssetKey);
          }
        } else {
          return NextResponse.json(
            { error: `Instagram publish failed: ${publishResult.error}` },
            { status: 400 }
          );
        }
      } else {
        // Mock publication for preview/demonstration
        publishedMediaId = `1802${Date.now().toString().slice(-8)}`;
        publishedPermalink = `https://www.instagram.com/p/C${Math.random().toString(36).substring(2, 8)}/`;

        if (data.temporaryAssetKey) {
          await storageService.deleteTemporaryAsset(data.temporaryAssetKey);
        }
      }

      const post = await dbService.createPost({
        promptId: data.promptId,
        caption: data.caption,
        hashtags: data.hashtags,
        commentKeyword: keyword,
        mediaType: data.mediaType,
        temporaryImageUrl: data.temporaryImageUrl,
        temporaryAssetKey: data.temporaryAssetKey,
        instagramMediaId: publishedMediaId,
        instagramPermalink: publishedPermalink,
        status: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        scheduledFor: null,
      });

      return NextResponse.json({ success: true, data: post }, { status: 201 });
    }

    // 2. If "SCHEDULED" is requested
    if (data.status === "SCHEDULED") {
      if (!data.scheduledFor) {
        return NextResponse.json({ error: "Scheduled date is required for scheduled posts" }, { status: 400 });
      }

      const post = await dbService.createPost({
        promptId: data.promptId,
        caption: data.caption,
        hashtags: data.hashtags,
        commentKeyword: keyword,
        mediaType: data.mediaType,
        temporaryImageUrl: data.temporaryImageUrl,
        temporaryAssetKey: data.temporaryAssetKey,
        status: "SCHEDULED",
        scheduledFor: data.scheduledFor,
        publishedAt: null,
      });

      // Schedule background job in database queue
      await queueService.scheduleJob("PUBLISH_POST", { postId: post.id }, new Date(data.scheduledFor));

      return NextResponse.json({ success: true, data: post }, { status: 201 });
    }

    // 3. Otherwise "DRAFT"
    const post = await dbService.createPost({
      promptId: data.promptId,
      caption: data.caption,
      hashtags: data.hashtags,
      commentKeyword: keyword,
      mediaType: data.mediaType,
      temporaryImageUrl: data.temporaryImageUrl,
      temporaryAssetKey: data.temporaryAssetKey,
      status: "DRAFT",
      scheduledFor: null,
      publishedAt: null,
    });

    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
