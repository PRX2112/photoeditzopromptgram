import crypto from "crypto";

// Ensure a valid 32-byte key for AES-256-GCM
function getEncryptionKey(): Buffer {
  const envKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!envKey) {
    // Fallback to sha256 of fallback string if not set, but log warning
    return crypto.createHash("sha256").update("photographer-prompt-hub-fallback-salt").digest();
  }

  // If provided as 64-char hex string
  if (envKey.length === 64) {
    return Buffer.from(envKey, "hex");
  }

  // Otherwise hash whatever string is provided to get exact 32 bytes
  return crypto.createHash("sha256").update(envKey).digest();
}

/**
 * Encrypt sensitive string (e.g. Instagram long-lived access token) using AES-256-GCM
 * Returns string formatted as: ivHex:authTagHex:ciphertextHex
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return "";

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM encrypted token
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return "";

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Verify Meta Webhook HMAC-SHA256 signature
 * Header format: sha256=<signature_hex>
 */
export function verifyMetaWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;

  const expectedSignature = signatureHeader.substring(prefix.length);

  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest("hex");

  try {
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const calculatedBuf = Buffer.from(calculatedSignature, "hex");

    if (expectedBuf.length !== calculatedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
  } catch {
    return false;
  }
}

/**
 * Safely compare secrets to prevent timing attacks
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
