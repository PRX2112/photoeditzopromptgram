import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { instagramService } from "@/lib/instagram";
import { dbService } from "@/lib/db-service";

// Connect active Instagram Account route

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const token = body.token || body.accessToken || process.env.META_INSTAGRAM_ACCESS_TOKEN;

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json(
        { error: "Access token is required to connect Instagram account" },
        { status: 400 }
      );
    }

    // Verify token with Meta Graph API
    const verifiedAccount = await instagramService.verifyAndFetchAccount(token.trim());

    // Subscribe app to account for messages and comments
    await instagramService.subscribeApp(verifiedAccount.igUserId, token.trim());

    // Connect in database/memory
    const connected = await dbService.connectInstagramAccount({
      igUserId: verifiedAccount.igUserId,
      username: verifiedAccount.username,
      name: verifiedAccount.name,
      profilePictureUrl: verifiedAccount.profilePictureUrl,
      accessToken: token.trim(),
      permissions: "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_contents,instagram_manage_messages,pages_show_list,pages_read_engagement",
    });

    return NextResponse.json({
      success: true,
      message: `Successfully connected Instagram account @${connected.username}`,
      account: {
        id: connected.id,
        igUserId: connected.igUserId,
        username: connected.username,
        name: connected.name,
        profilePictureUrl: connected.profilePictureUrl,
        isConnected: connected.isConnected,
        permissions: connected.permissions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to connect Instagram account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
