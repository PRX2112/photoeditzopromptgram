import { NextRequest, NextResponse } from "next/server";
import { instagramService } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (error || !code) {
    const errorMsg = encodeURIComponent(errorDescription || error || "Authorization cancelled");
    return NextResponse.redirect(`${baseUrl}/settings?error=${errorMsg}`);
  }

  try {
    const accountData = await instagramService.exchangeCodeForToken(code);
    console.log(`Connected Instagram account @${accountData.username} (ID: ${accountData.igUserId})`);

    return NextResponse.redirect(`${baseUrl}/settings?connected=true&username=${encodeURIComponent(accountData.username)}`);
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Token exchange failed");
    return NextResponse.redirect(`${baseUrl}/settings?error=${msg}`);
  }
}
