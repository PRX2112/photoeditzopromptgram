import crypto from "crypto";

export interface EphemeralAsset {
  key: string;
  data: Buffer;
  mimeType: string;
  filename: string;
  size: number;
  createdAt: Date;
  expiresAt: Date;
}

// Global in-memory ephemeral registry for serverless lifespan
const globalEphemeralStorage = globalThis as unknown as {
  ephemeralAssets?: Map<string, EphemeralAsset>;
};

if (!globalEphemeralStorage.ephemeralAssets) {
  globalEphemeralStorage.ephemeralAssets = new Map<string, EphemeralAsset>();
}

const assetsMap = globalEphemeralStorage.ephemeralAssets;

export const storageService = {
  /**
   * Upload an image to temporary ephemeral object storage
   * Returns a publicly accessible HTTPS URL suitable for Meta Instagram Graph API container creation
   */
  uploadTemporaryAsset: async (
    fileBuffer: Buffer,
    filename: string,
    mimeType: string = "image/jpeg",
    retentionHours: number = 24
  ): Promise<{ publicUrl: string; assetKey: string; expiresAt: Date }> => {
    // Generate secure randomized key
    const assetKey = `tmp_${crypto.randomBytes(16).toString("hex")}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + retentionHours * 3600 * 1000);

    const asset: EphemeralAsset = {
      key: assetKey,
      data: fileBuffer,
      mimeType,
      filename,
      size: fileBuffer.length,
      createdAt: now,
      expiresAt,
    };

    assetsMap.set(assetKey, asset);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const publicUrl = `${baseUrl.replace(/\/$/, "")}/api/media/temp/${assetKey}`;

    return {
      publicUrl,
      assetKey,
      expiresAt,
    };
  },

  /**
   * Retrieve temporary asset by key
   */
  getTemporaryAsset: (assetKey: string): EphemeralAsset | null => {
    const asset = assetsMap.get(assetKey);
    if (!asset) return null;

    // Check expiry
    if (new Date() > asset.expiresAt) {
      assetsMap.delete(assetKey);
      return null;
    }

    return asset;
  },

  /**
   * Delete temporary asset immediately upon successful publication
   */
  deleteTemporaryAsset: async (assetKey: string): Promise<boolean> => {
    if (!assetKey) return false;
    const deleted = assetsMap.delete(assetKey);
    return deleted;
  },

  /**
   * Clean up all expired temporary assets (scheduled job / cron)
   */
  cleanupExpiredAssets: async (): Promise<number> => {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, asset] of assetsMap.entries()) {
      if (now > asset.expiresAt) {
        assetsMap.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  },

  /**
   * Validate if an image URL is a valid public HTTPS URL
   */
  isValidPublicImageUrl: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  },
};
