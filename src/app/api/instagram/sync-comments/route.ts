import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { webhookProcessor } from "@/lib/webhooks";
import { resolveAccessToken } from "@/lib/instagram";
import type { InstagramWebhookPayload } from "@/types";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get active Instagram account & published posts with retry for Neon wake-up
    let account = null;
    let publishedPosts: Array<{
      id: string;
      promptId: string;
      caption: string;
      hashtags: string;
      commentKeyword: string;
      instagramMediaId: string | null;
      instagramAccountId: string | null;
      prompt?: { id: string; slug: string; title: string; category: string } | null;
    }> = [];

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        account = await prisma.instagramAccount.findFirst({
          where: { isConnected: true },
        });
        publishedPosts = await prisma.post.findMany({
          where: {
            status: "PUBLISHED",
            instagramMediaId: { not: null },
          },
          include: { prompt: true },
        });
        break;
      } catch (dbErr) {
        if (attempt === 2) throw dbErr;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const token = account?.accessTokenEncrypted
      ? resolveAccessToken(account.accessTokenEncrypted)
      : process.env.META_INSTAGRAM_ACCESS_TOKEN;
    const igUserId = account?.igUserId || process.env.META_INSTAGRAM_ACCOUNT_ID || "17841479958291582";

    if (!token) {
      return NextResponse.json({ error: "No Instagram access token available" }, { status: 400 });
    }

    if (publishedPosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No published posts with Instagram media IDs found to sync.",
        processedCount: 0,
      });
    }

    let totalCommentsFound = 0;
    const allResults = [];

    // 2. For each post, query Meta Graph API comments
    for (const post of publishedPosts) {
      const mediaId = post.instagramMediaId!;
      const commentsUrl = `https://graph.facebook.com/v21.0/${mediaId}/comments?fields=id,text,timestamp,from,username&access_token=${token}`;

      try {
        const res = await fetch(commentsUrl);
        const data = await res.json();

        if (!res.ok || !data.data) {
          console.warn(`Failed to fetch comments for media ${mediaId}:`, data.error);
          continue;
        }

        const comments = data.data as Array<{
          id: string;
          text: string;
          timestamp: string;
          from?: { id: string; username?: string };
          username?: string;
        }>;

        totalCommentsFound += comments.length;

        // Build standard webhook payload to process each comment idempotently
        for (const comment of comments) {
          const payload: InstagramWebhookPayload = {
            object: "instagram",
            entry: [
              {
                id: igUserId,
                time: Math.floor(new Date(comment.timestamp).getTime() / 1000),
                changes: [
                  {
                    field: "comments",
                    value: {
                      id: comment.id,
                      text: comment.text,
                      created_time: Math.floor(new Date(comment.timestamp).getTime() / 1000),
                      from: comment.from || { id: comment.id, username: comment.username },
                      media: { id: mediaId },
                    },
                  },
                ],
              },
            ],
          };

          const results = await webhookProcessor.processWebhookEvent(payload, "manual-sync");
          allResults.push(...results);
        }
      } catch (postErr) {
        console.error(`Error querying comments for post ${post.id}:`, postErr);
      }
    }

    return NextResponse.json({
      success: true,
      publishedPostsChecked: publishedPosts.length,
      totalCommentsFound,
      processedEvents: allResults.length,
      results: allResults,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
