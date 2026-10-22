import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookSignature } from "@/lib/crypto";
import { webhookProcessor } from "@/lib/webhooks";
import type { InstagramWebhookPayload } from "@/types";

/**
 * Meta Webhook Verification Handshake (GET)
 * Meta calls this endpoint when setting up webhook subscriptions in the App Dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "766cf977897aa0cdc6dd2e30701d19c4";

  if (mode === "subscribe" && token === expectedToken) {
    console.log("Meta Webhook subscription verified successfully");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("Meta Webhook verification token mismatch");
  return new NextResponse("Forbidden: Verification token mismatch", { status: 403 });
}

/**
 * Meta Webhook Event Receiver (POST)
 * Receives comment notifications from Instagram
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.META_APP_SECRET;

    // Verify signature if app secret is configured
    if (appSecret && appSecret.trim().length > 0) {
      const isValid = verifyMetaWebhookSignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.warn("Invalid Meta webhook signature received");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload: InstagramWebhookPayload = JSON.parse(rawBody);

    if (payload.object !== "instagram") {
      return NextResponse.json({ status: "ignored_non_instagram_object" }, { status: 200 });
    }

    // Process event asynchronously or synchronously
    const results = await webhookProcessor.processWebhookEvent(payload);

    return NextResponse.json({
      status: "success",
      processed: results.length,
      results,
    });
  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    // Always return 200 to acknowledge receipt to Meta to prevent retry loops on bad payloads
    return NextResponse.json(
      { status: "error_acknowledged", error: String(error) },
      { status: 200 }
    );
  }
}
