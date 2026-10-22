import { encryptToken, decryptToken } from "./crypto";
import type {
  InstagramMediaContainerResponse,
  InstagramMediaPublishResponse,
  InstagramMediaDetails,
} from "@/types";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface InstagramPublishResult {
  success: boolean;
  mediaId?: string;
  permalink?: string;
  error?: string;
}

export interface PrivateReplyResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number;
}

export const instagramService = {
  /**
   * Check if Meta credentials are fully configured in server environment
   */
  isConfigured: (): boolean => {
    return Boolean(
      process.env.META_APP_ID &&
        process.env.META_APP_SECRET &&
        process.env.META_APP_ID.trim().length > 0 &&
        process.env.META_APP_SECRET.trim().length > 0
    );
  },

  /**
   * Generate official Meta OAuth authorization URL
   */
  getOAuthUrl: (state: string): string => {
    const appId = process.env.META_APP_ID || "";
    const redirectUri = `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/instagram/callback`;

    const scopes = [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",
      "instagram_manage_messages",
      "pages_show_list",
      "pages_read_engagement",
    ].join(",");

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: "code",
      state,
    });

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  },

  /**
   * Exchange authorization code for a long-lived access token and linked IG account
   */
  exchangeCodeForToken: async (
    code: string
  ): Promise<{
    accessToken: string;
    igUserId: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
    expiresIn?: number;
  }> => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/instagram/callback`;

    if (!appId || !appSecret) {
      throw new Error("Meta App ID and Secret must be configured in environment variables");
    }

    // 1. Get short-lived user token
    const tokenUrl = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }).toString()}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      throw new Error(`Token exchange failed: ${tokenData.error?.message || "Unknown error"}`);
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange for long-lived user token (valid for ~60 days)
    const longLivedUrl = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    }).toString()}`;

    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();

    const longLivedToken = longLivedData.access_token || shortLivedToken;
    const expiresIn = longLivedData.expires_in;

    // 3. Find connected Instagram Professional / Business Accounts
    const accountsUrl = `${GRAPH_API_BASE}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
      access_token: longLivedToken,
    }).toString()}`;

    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json();

    if (!accountsRes.ok || !accountsData.data) {
      throw new Error(`Failed to query accounts: ${accountsData.error?.message || "No pages found"}`);
    }

    // Look for page with linked instagram_business_account
    let targetIgAccount: {
      id: string;
      username: string;
      name?: string;
      profile_picture_url?: string;
      pageAccessToken?: string;
    } | null = null;

    for (const page of accountsData.data) {
      if (page.instagram_business_account) {
        targetIgAccount = {
          id: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          name: page.instagram_business_account.name,
          profile_picture_url: page.instagram_business_account.profile_picture_url,
          pageAccessToken: page.access_token,
        };
        break;
      }
    }

    if (!targetIgAccount) {
      throw new Error(
        "No linked Instagram Professional (Business or Creator) Account found on your Facebook Pages. Please link your Instagram account to a Facebook page in Meta Business Suite."
      );
    }

    return {
      accessToken: targetIgAccount.pageAccessToken || longLivedToken,
      igUserId: targetIgAccount.id,
      username: targetIgAccount.username,
      name: targetIgAccount.name,
      profilePictureUrl: targetIgAccount.profile_picture_url,
      expiresIn,
    };
  },

  /**
   * Publish an image post using official Instagram Content Publishing API
   */
  publishImagePost: async (
    encryptedToken: string,
    igUserId: string,
    imageUrl: string,
    caption: string
  ): Promise<InstagramPublishResult> => {
    try {
      const accessToken = decryptToken(encryptedToken);

      // Step 1: Create Container
      const containerUrl = `${GRAPH_API_BASE}/${igUserId}/media`;
      const containerRes = await fetch(containerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: accessToken,
        }),
      });

      const containerData: InstagramMediaContainerResponse & { error?: { message: string; code: number } } =
        await containerRes.json();

      if (!containerRes.ok || containerData.error) {
        return {
          success: false,
          error: `Failed to create media container: ${containerData.error?.message || "Unknown error"}`,
        };
      }

      const containerId = containerData.id;

      // Step 2: Poll container status until FINISHED
      let status: "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" = "IN_PROGRESS";
      let attempts = 0;
      const maxAttempts = 10;

      while (status === "IN_PROGRESS" && attempts < maxAttempts) {
        attempts++;
        // Wait 3 seconds between status polls
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusUrl = `${GRAPH_API_BASE}/${containerId}?${new URLSearchParams({
          fields: "status_code",
          access_token: accessToken,
        }).toString()}`;

        const statusRes = await fetch(statusUrl);
        const statusData: InstagramMediaDetails = await statusRes.json();

        if (statusData.status_code) {
          status = statusData.status_code;
        }
      }

      if (status !== "FINISHED") {
        return {
          success: false,
          error: `Media container processing failed or timed out with status: ${status}`,
        };
      }

      // Step 3: Publish Media
      const publishUrl = `${GRAPH_API_BASE}/${igUserId}/media_publish`;
      const publishRes = await fetch(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      });

      const publishData: InstagramMediaPublishResponse & { error?: { message: string } } =
        await publishRes.json();

      if (!publishRes.ok || publishData.error) {
        return {
          success: false,
          error: `Failed to publish media: ${publishData.error?.message || "Unknown error"}`,
        };
      }

      const mediaId = publishData.id;

      // Step 4: Retrieve permalink
      const detailsUrl = `${GRAPH_API_BASE}/${mediaId}?${new URLSearchParams({
        fields: "permalink,timestamp",
        access_token: accessToken,
      }).toString()}`;

      const detailsRes = await fetch(detailsUrl);
      const detailsData: InstagramMediaDetails = await detailsRes.json();

      return {
        success: true,
        mediaId,
        permalink: detailsData.permalink || `https://www.instagram.com/p/${mediaId}/`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * Send a permitted Instagram Private Reply for a comment
   * Official endpoint: POST /{ig-user-id}/messages with recipient: { comment_id }
   */
  sendPrivateReply: async (
    encryptedToken: string,
    igUserId: string,
    commentId: string,
    messageText: string
  ): Promise<PrivateReplyResult> => {
    try {
      const accessToken = decryptToken(encryptedToken);

      const endpoint = `${GRAPH_API_BASE}/${igUserId}/messages`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: {
            comment_id: commentId,
          },
          message: {
            text: messageText,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        return {
          success: false,
          error: data.error?.message || "Meta private reply request failed",
          errorCode: data.error?.code,
        };
      }

      return {
        success: true,
        messageId: data.message_id || data.id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
};
