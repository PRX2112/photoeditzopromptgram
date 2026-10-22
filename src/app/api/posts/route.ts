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
      if (!data.temporaryImageUrl) {
        return NextResponse.json(
          { error: "An image URL is required to publish to Instagram." },
          { status: 400 }
        );
      }

      if (!instagramService.isConfigured()) {
        return NextResponse.json(
          { error: "Meta Instagram credentials (META_APP_ID, META_APP_SECRET) are not configured." },
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
          { error: "Connected Instagram account is missing an access token. Please reconnect the account." },
          { status: 400 }
        );
      }

      const fullCaption = `${data.caption}\n\n${data.hashtags}`.trim();
      const publishResult = await instagramService.publishImagePost(
        connectedAccount.accessTokenEncrypted,
        connectedAccount.igUserId,
        data.temporaryImageUrl,
        fullCaption
      );

      if (!publishResult.success || !publishResult.mediaId) {
        return NextResponse.json(
          { error: `Meta Instagram publish failed: ${publishResult.error || "No media ID returned"}` },
          { status: 502 }
        );
      }

      // Clean up ephemeral asset immediately after confirmed successful publish
      if (data.temporaryAssetKey) {
        await storageService.deleteTemporaryAsset(data.temporaryAssetKey);
      }

      // Persist to database only after verified Meta publication
      const post = await dbService.createPost({
        promptId: data.promptId,
        instagramAccountId: connectedAccount.id,
        caption: data.caption,
        hashtags: data.hashtags,
        commentKeyword: keyword,
        mediaType: data.mediaType,
        temporaryImageUrl: data.temporaryImageUrl,
        temporaryAssetKey: null,
        instagramMediaId: publishResult.mediaId,
        instagramPermalink: publishResult.permalink || null,
        status: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        scheduledFor: null,
      });

      return NextResponse.json({ success: true, data: post }, { status: 201 });
    }

    // 2. If "SCHEDULED" is requested
    if (data.status === "SCHEDULED") {
      if (!data.scheduledFor) {
        return NextResponse.json(
          { error: "Scheduled date and time are required for scheduled posts." },
          { status: 400 }
        );
      }

      const scheduledTime = new Date(data.scheduledFor);
      if (isNaN(scheduledTime.getTime()) || scheduledTime <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled time must be a valid future date and time." },
          { status: 400 }
        );
      }

      const connectedAccount = await dbService.getConnectedInstagramAccount();

      const post = await dbService.createPost({
        promptId: data.promptId,
        instagramAccountId: connectedAccount?.id || null,
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
      await queueService.scheduleJob("PUBLISH_POST", { postId: post.id }, scheduledTime);

      return NextResponse.json({ success: true, data: post }, { status: 201 });
    }

    // 3. Otherwise "DRAFT"
    const connectedAccount = await dbService.getConnectedInstagramAccount();
    const post = await dbService.createPost({
      promptId: data.promptId,
      instagramAccountId: connectedAccount?.id || null,
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
