import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";
import { instagramService } from "@/lib/instagram";

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

    const requests = await dbService.getPromptRequests();
    const req = requests.find((r) => r.id === requestId);

    if (!req) {
      return NextResponse.json({ error: "Prompt request not found" }, { status: 404 });
    }

    if (req.deliveryStatus === "DELIVERED") {
      return NextResponse.json(
        { error: "This request has already been successfully delivered." },
        { status: 400 }
      );
    }

    // Check 7-day Meta Private Reply window from comment creation
    const createdTime = new Date(req.createdAt).getTime();
    const sevenDaysMs = 7 * 86400 * 1000;
    if (Date.now() - createdTime > sevenDaysMs) {
      await dbService.updatePromptRequest(req.id, {
        deliveryStatus: "FAILED",
        errorMessage: "Cannot retry: comment is older than Meta's permitted 7-day private reply window.",
        retryCount: req.retryCount + 1,
      });

      return NextResponse.json(
        { error: "Cannot retry: comment exceeds Meta's permitted 7-day private reply window." },
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
    if (!connectedAccount || !connectedAccount.accessTokenEncrypted) {
      return NextResponse.json(
        { error: "No connected Instagram Professional account found. Please connect an account in Settings." },
        { status: 400 }
      );
    }

    // Resolve prompt and construct URL
    if (!req.matchedPromptId) {
      return NextResponse.json(
        { error: "No prompt is matched with this request. Cannot deliver." },
        { status: 400 }
      );
    }

    const prompt = await dbService.getPromptById(req.matchedPromptId);
    if (!prompt) {
      return NextResponse.json(
        { error: "Matched prompt no longer exists in library." },
        { status: 404 }
      );
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const promptUrl = `${baseUrl}/p/${prompt.slug}`;
    const settings = await dbService.getAutomationSettings();
    const replyText = settings.replyTemplate
      ? settings.replyTemplate
          .replace("{prompt_url}", promptUrl)
          .replace("{prompt_title}", prompt.title)
          .replace("{category}", prompt.category)
      : `Here is the photography prompt you requested: ${promptUrl}`;

    // Execute genuine Meta API private reply call
    const sendResult = await instagramService.sendPrivateReply(
      connectedAccount.accessTokenEncrypted,
      connectedAccount.igUserId,
      req.incomingCommentId,
      replyText
    );

    if (!sendResult.success || !sendResult.messageId) {
      const updated = await dbService.updatePromptRequest(req.id, {
        deliveryStatus: "FAILED",
        errorMessage: sendResult.error || "Meta private reply failed",
        retryCount: req.retryCount + 1,
      });

      return NextResponse.json(
        {
          error: `Meta private reply failed: ${sendResult.error || "No message ID returned"}`,
          data: updated,
        },
        { status: 502 }
      );
    }

    const updated = await dbService.updatePromptRequest(req.id, {
      deliveryStatus: "DELIVERED",
      privateReplyId: sendResult.messageId,
      deliveredAt: new Date().toISOString(),
      retryCount: req.retryCount + 1,
      errorMessage: null,
    });

    return NextResponse.json({
      success: true,
      message: "Prompt delivered successfully via Meta Private Reply",
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
