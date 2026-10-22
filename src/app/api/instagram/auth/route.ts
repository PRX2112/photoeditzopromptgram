import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { instagramService } from "@/lib/instagram";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!instagramService.isConfigured()) {
    return NextResponse.json(
      {
        error:
          "Meta App ID and Secret are not configured in environment variables. Please add META_APP_ID and META_APP_SECRET.",
      },
      { status: 400 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = instagramService.getOAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
