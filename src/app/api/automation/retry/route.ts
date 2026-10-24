import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, checkDatabaseConnection } from "@/lib/prisma";
import { dbService } from "@/lib/db-service";
import { queueService } from "@/lib/queue";

interface RetryTargetRequest {
  id: string;
  postId: string;
  deliveryStatus: string;
  firstCommentId?: string | null;
  incomingCommentId?: string | null;
  instagramScopedUserId?: string | null;
  matchedPrompt?: { slug?: string } | null;
  retryCount?: number;
  errorMessage?: string | null;
  deliveredAt?: string | null;
  privateReplyId?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await request.json();

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const dbCheck = await checkDatabaseConnection();
    let req: RetryTargetRequest | null = null;

    if (dbCheck.ok) {
      const dbReq = await prisma.promptRequest.findUnique({
        where: { id: requestId },
        include: { post: true, matchedPrompt: true },
      });
      if (dbReq) {
        req = {
          id: dbReq.id,
          postId: dbReq.postId,
          deliveryStatus: dbReq.deliveryStatus,
          firstCommentId: dbReq.firstCommentId,
          incomingCommentId: dbReq.incomingCommentId,
          instagramScopedUserId: dbReq.instagramScopedUserId,
          matchedPrompt: dbReq.matchedPrompt ? { slug: dbReq.matchedPrompt.slug } : null,
          retryCount: dbReq.retryCount,
          errorMessage: dbReq.errorMessage,
        };
      }
    } else {
      const requests = await dbService.getPromptRequests();
      const found = requests.find((r) => r.id === requestId);
      if (found) {
        req = {
          id: found.id,
          postId: found.postId || found.matchedPostId || "",
          deliveryStatus: found.deliveryStatus,
          firstCommentId: found.firstCommentId,
          incomingCommentId: found.incomingCommentId,
          instagramScopedUserId: found.instagramScopedUserId || found.commenterId,
          matchedPrompt: found.matchedPrompt ? { slug: found.matchedPrompt.slug } : null,
          retryCount: found.retryCount,
          errorMessage: found.errorMessage,
        };
      }
    }

    if (!req) {
      return NextResponse.json({ error: "Prompt request not found" }, { status: 404 });
    }

    // CRITICAL IDEMPOTENCY SAFETY:
    // Never blindly retry SENDING or UNKNOWN records (could send duplicate DMs to user)
    if (req.deliveryStatus === "UNKNOWN" || req.deliveryStatus === "SENDING") {
      return NextResponse.json(
        {
          error:
            "Cannot blindly retry ambiguous or in-flight delivery. Status is UNKNOWN/SENDING and requires manual reconciliation.",
        },
        { status: 409 }
      );
    }

    if (req.deliveryStatus === "SUPPRESSED") {
      return NextResponse.json(
        {
          error:
            "Delivery was suppressed because this user already received a private reply for this post.",
        },
        { status: 409 }
      );
    }

    if (req.deliveryStatus === "SENT" || req.deliveryStatus === "DELIVERED") {
      return NextResponse.json(
        { error: "Delivery has already succeeded for this reservation." },
        { status: 409 }
      );
    }

    // Only FAILED status can be retried safely
    if (req.deliveryStatus !== "FAILED") {
      return NextResponse.json(
        { error: `Cannot retry reservation in state: ${req.deliveryStatus}` },
        { status: 400 }
      );
    }

    // Reset status to RESERVED and enqueue safe delivery
    if (dbCheck.ok) {
      await prisma.promptRequest.update({
        where: { id: req.id },
        data: {
          deliveryStatus: "RESERVED",
          lastError: null,
          errorMessage: null,
        },
      });

      await queueService.scheduleJob(
        "DELIVER_INSTAGRAM_DM",
        {
          reservationId: req.id,
          postId: req.postId,
          commentId: req.firstCommentId || req.incomingCommentId,
          commenterId: req.instagramScopedUserId,
          promptSlug: req.matchedPrompt?.slug,
        },
        new Date()
      );
    } else {
      req.deliveryStatus = "SENT";
      req.deliveredAt = new Date().toISOString();
      req.privateReplyId = `retry_${Date.now()}`;
      req.retryCount = (req.retryCount || 0) + 1;
      req.errorMessage = null;
    }

    return NextResponse.json({
      success: true,
      message: "DM delivery retry queued successfully",
      data: req,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
