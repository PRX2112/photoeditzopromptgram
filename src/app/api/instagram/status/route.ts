import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { instagramService } from "@/lib/instagram";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isMetaConfigured = instagramService.isConfigured();
    const appId = process.env.META_APP_ID || "";
    const hasSecret = Boolean(process.env.META_APP_SECRET && process.env.META_APP_SECRET.length > 0);
    const webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "";

    return NextResponse.json({
      success: true,
      metaConfigured: isMetaConfigured,
      appId: appId ? `${appId.slice(0, 4)}...${appId.slice(-4)}` : null,
      hasSecret,
      webhookVerifyToken: webhookVerifyToken ? "Configured" : "Missing",
      account: {
        isConnected: false,
        username: null,
        name: null,
        igUserId: null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
