import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { queueService } from "@/lib/queue";
import { instagramPublishingService } from "@/lib/instagram/publishing";
import { z } from "zod";

const CreatePostSchema = z.object({
  promptId: z.string().min(1, "Associated prompt is required"),
  caption: z.string().min(1, "Caption is required"),
  hashtags: z.string().nullable().optional().default(""),
  commentKeyword: z.string().min(1, "Comment keyword is required"),
  mediaType: z.string().nullable().optional().default("IMAGE"),
  blobUrl: z.string().nullable().optional(),
  blobPathname: z.string().nullable().optional(),
  renderedImageUrl: z.string().nullable().optional(),
  renderedBlobPathname: z.string().nullable().optional(),
  temporaryImageUrl: z.string().nullable().optional(),
  temporaryAssetKey: z.string().nullable().optional(),
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
    const finalBlobUrl = data.renderedImageUrl || data.blobUrl || data.temporaryImageUrl || undefined;

    // 1. Create Post Record in Database
    const post = await dbService.createPost({
      promptId: data.promptId,
      caption: data.caption,
      hashtags: data.hashtags || "",
      commentKeyword: keyword,
      mediaType: data.mediaType || "IMAGE",
      blobUrl: finalBlobUrl,
      blobPathname: data.renderedBlobPathname || data.blobPathname || undefined,
      renderedImageUrl: data.renderedImageUrl || undefined,
      renderedBlobPathname: data.renderedBlobPathname || undefined,
      renderedImageStatus: data.renderedImageUrl ? "READY_TO_PUBLISH" : "UPLOADED",
      renderedAt: data.renderedImageUrl ? new Date().toISOString() : undefined,
      temporaryImageUrl: finalBlobUrl,
      temporaryAssetKey: data.temporaryAssetKey || undefined,
      imageUploadedAt: new Date().toISOString(),
      imageLifecycleStatus: "READY_TO_PUBLISH",
      status: data.status === "PUBLISHED" ? "DRAFT" : data.status, // temporarily DRAFT if about to publish
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor).toISOString() : null,
      publishedAt: null,
    });

    // 2. If "PUBLISHED" (Publish Now) is requested:
    // Execute official publishing workflow with container verification & cleanup enqueuing
    if (data.status === "PUBLISHED") {
      const publishResult = await instagramPublishingService.publishPost(post.id, "api-composer");

      if (!publishResult.success) {
        return NextResponse.json(
          {
            error: publishResult.error || "Publication failed",
            isAmbiguous: publishResult.isAmbiguous,
            postId: post.id,
          },
          { status: 400 }
        );
      }

      const updated = await dbService.getPosts();
      const confirmedPost = updated.find((p) => p.id === post.id);

      return NextResponse.json({ success: true, data: confirmedPost || post }, { status: 201 });
    }

    // 3. If "SCHEDULED" is requested
    if (data.status === "SCHEDULED") {
      if (!data.scheduledFor) {
        return NextResponse.json({ error: "Scheduled date is required for scheduled posts" }, { status: 400 });
      }

      await dbService.updatePost(post.id, {
        status: "SCHEDULED",
        scheduledFor: data.scheduledFor,
      });

      // Schedule background job in database queue
      await queueService.scheduleJob("PUBLISH_POST", { postId: post.id }, new Date(data.scheduledFor));

      return NextResponse.json({ success: true, data: post }, { status: 201 });
    }

    // 4. Otherwise "DRAFT"
    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
