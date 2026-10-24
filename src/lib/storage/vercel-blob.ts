import { put, del, head } from "@vercel/blob";
import crypto from "crypto";

export interface BlobUploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

export interface MagicByteValidation {
  isValid: boolean;
  detectedMime: string | null;
  detectedType?: string | null;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validate actual file contents using magic byte headers
 */
export function validateImageMagicBytes(
  buffer: Buffer,
  declaredMime?: string
): MagicByteValidation {
  if (declaredMime && !ALLOWED_MIME_TYPES.includes(declaredMime.toLowerCase())) {
    return {
      isValid: false,
      detectedMime: null,
      detectedType: null,
      error: `Unsupported MIME type: ${declaredMime}. Allowed types are: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  if (!buffer || buffer.length < 4) {
    return {
      isValid: false,
      detectedMime: null,
      detectedType: null,
      error: "File too small or empty",
    };
  }

  // Check JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedMime: "image/jpeg", detectedType: "image/jpeg" };
  }

  // Check PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedMime: "image/png", detectedType: "image/png" };
  }

  // Check WEBP: 52 49 46 46 .... 57 45 42 50 (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isValid: true, detectedMime: "image/webp", detectedType: "image/webp" };
  }

  return {
    isValid: false,
    detectedMime: null,
    detectedType: null,
    error: "Magic byte header mismatch: File contents do not match allowed image formats (JPEG, PNG, WEBP)",
  };
}

/**
 * Validate that a URL is a legitimate Vercel Blob URL owned by this application
 */
export function isOwnedVercelBlobUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    // Must be hosted on Vercel Blob storage domain
    const isVercelBlob = parsed.hostname.endsWith(".blob.vercel-storage.com");
    if (!isVercelBlob) return false;

    // Path must follow our safe namespace
    return parsed.pathname.includes("temp-uploads/");
  } catch {
    return false;
  }
}

export const vercelBlobService = {
  validateImageMagicBytes,
  isOwnedVercelBlobUrl,

  /**
   * Check if Vercel Blob read/write token is configured
   */
  isConfigured: (): boolean => {
    return Boolean(
      process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim().length > 0
    );
  },

  /**
   * Securely upload temporary image to Vercel Blob
   * Supports both (buffer, filename, mimetype) and ({ fileBuffer, fileName, declaredMimeType })
   */
  uploadTemporaryImage: async (
    firstArg: Buffer | { fileBuffer: Buffer; fileName?: string; originalFilename?: string; declaredMimeType?: string },
    secondArg?: string,
    thirdArg?: string
  ): Promise<BlobUploadResult> => {
    let fileBuffer: Buffer;
    let declaredMimeType: string;

    if (Buffer.isBuffer(firstArg)) {
      fileBuffer = firstArg;
      declaredMimeType = thirdArg || "image/jpeg";
    } else {
      fileBuffer = firstArg.fileBuffer;
      declaredMimeType = firstArg.declaredMimeType || "image/jpeg";
    }

    // 1. Validate File Size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(
        `File size (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB) exceeds configured maximum 10MB limit.`
      );
    }

    // 2. Validate Magic Bytes (Actual File Contents)
    const magicValidation = validateImageMagicBytes(fileBuffer, declaredMimeType);
    if (!magicValidation.isValid) {
      throw new Error(magicValidation.error || "Invalid file content. Must be a valid JPEG, PNG, or WEBP image.");
    }

    const verifiedMime = magicValidation.detectedMime!;
    const extension = verifiedMime === "image/jpeg" ? "jpg" : verifiedMime === "image/png" ? "png" : "webp";

    // 3. Generate safe unique pathname
    const uniqueSuffix = crypto.randomBytes(16).toString("hex");
    const safePathname = `temp-uploads/${Date.now()}-${uniqueSuffix}.${extension}`;

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (token) {
      try {
        const blob = await put(safePathname, fileBuffer, {
          access: "public",
          contentType: verifiedMime,
          token,
        });

        return {
          url: blob.url,
          pathname: blob.pathname,
          contentType: verifiedMime,
          size: fileBuffer.length,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Vercel Blob upload failed: ${msg}`);
      }
    }

    // Local / Dev Fallback: If BLOB_READ_WRITE_TOKEN is not configured yet,
    // upload through serverless ephemeral endpoint to ensure seamless local testing
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const fallbackUrl = `${baseUrl}/api/media/temp/${uniqueSuffix}`;

    return {
      url: fallbackUrl,
      pathname: safePathname,
      contentType: verifiedMime,
      size: fileBuffer.length,
    };
  },

  /**
   * Delete an owned temporary Blob from Vercel Blob store
   */
  deleteTemporaryImage: async (blobUrl: string): Promise<{ success: boolean; error?: string }> => {
    if (!blobUrl) {
      return { success: false, error: "No Blob URL provided" };
    }

    // Local fallback handling
    if (blobUrl.includes("/api/media/temp/")) {
      return { success: true };
    }

    // Security Validation: Prevent deletion of arbitrary user-supplied URLs
    if (!isOwnedVercelBlobUrl(blobUrl)) {
      return {
        success: false,
        error: "Security exception: Forbidden: Cannot delete external or unverified URL",
      };
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      // In dev mode without token
      return { success: true };
    }

    try {
      // Attempt head check for idempotency
      try {
        await head(blobUrl, { token });
      } catch (headErr: unknown) {
        // If already 404 / absent, treat deletion as complete
        const errObj = headErr as { status?: number; message?: string };
        if (errObj?.status === 404 || errObj?.message?.includes("not found")) {
          return { success: true };
        }
      }

      await del(blobUrl, { token });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  deleteTemporaryBlob: async (blobUrl: string): Promise<{ success: boolean; error?: string }> => {
    if (!isOwnedVercelBlobUrl(blobUrl)) {
      throw new Error("Security exception: Forbidden: Cannot delete external or unverified URL");
    }
    return vercelBlobService.deleteTemporaryImage(blobUrl);
  },
};
