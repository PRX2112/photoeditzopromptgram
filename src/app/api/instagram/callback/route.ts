import { NextRequest, NextResponse } from "next/server";
import { instagramService } from "@/lib/instagram";
import { encryptToken } from "@/lib/crypto";
import { dbService } from "@/lib/db-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (error || !code) {
    const errorMsg = encodeURIComponent(errorDescription || error || "Authorization was cancelled by user.");
    return NextResponse.redirect(`${baseUrl}/settings?error=${errorMsg}`);
  }

  try {
    // 1. Exchange OAuth code for long-lived access token and target IG Professional Account
    const accountData = await instagramService.exchangeCodeForToken(code);

    if (!accountData.accessToken || !accountData.igUserId) {
      throw new Error("Meta OAuth exchange completed but did not return valid account credentials.");
    }

    // 2. Encrypt long-lived access token using AES-256-GCM
    const encryptedToken = encryptToken(accountData.accessToken);

    // 3. Calculate expiration date if available
    const tokenExpiresAt = accountData.expiresIn
      ? new Date(Date.now() + accountData.expiresIn * 1000)
      : new Date(Date.now() + 60 * 86400 * 1000); // Meta long-lived tokens default to 60 days

    // 4. Confirmed database persistence
    await dbService.saveInstagramAccount({
      igUserId: accountData.igUserId,
      username: accountData.username,
      name: accountData.name || null,
      profilePictureUrl: accountData.profilePictureUrl || null,
      accessTokenEncrypted: encryptedToken,
      tokenExpiresAt,
      permissions: "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement",
    });

    return NextResponse.redirect(
      `${baseUrl}/settings?connected=true&username=${encodeURIComponent(accountData.username)}`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Token exchange or database persistence failed");
    return NextResponse.redirect(`${baseUrl}/settings?error=${msg}`);
  }
}
