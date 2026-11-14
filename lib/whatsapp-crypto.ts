import crypto from "crypto";
import { isProductionEnvironment } from "@/lib/bootstrap";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended by NIST for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag
const VERSION_PREFIX = "v1";

/**
 * Derives a 32-byte (256-bit) encryption key using SHA-256 over the configured secret.
 * In production, WHATSAPP_TOKEN_ENCRYPTION_KEY (or JWT_SECRET) must be present and never hardcoded.
 */
function deriveEncryptionKey(): Buffer {
  const isProd = isProductionEnvironment();
  const explicitKey = (process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || "").trim();
  const fallbackKey = (
    process.env.JWT_SECRET ||
    process.env.ADMIN_INITIAL_PASSWORD ||
    ""
  ).trim();
  const rawSecret = explicitKey || fallbackKey;

  if (!rawSecret) {
    if (isProd) {
      throw new Error(
        "SECURITY ERROR: WHATSAPP_TOKEN_ENCRYPTION_KEY environment variable (>= 32 chars) is required in production."
      );
    }
    // Strictly local development fallback (never used in production)
    return crypto
      .createHash("sha256")
      .update("connectpro_dev_only_whatsapp_token_key_not_for_prod")
      .digest();
  }

  if (isProd && rawSecret.length < 32) {
    throw new Error(
      "SECURITY ERROR: WHATSAPP_TOKEN_ENCRYPTION_KEY must be at least 32 characters long in production."
    );
  }

  return crypto.createHash("sha256").update(rawSecret).digest();
}

/**
 * Encrypts a plaintext Meta WABA access token using AES-256-GCM.
 * Returns format: v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 */
export function encryptAccessToken(plainToken: string): string {
  if (!plainToken || typeof plainToken !== "string") {
    throw new Error("Cannot encrypt an empty access token.");
  }

  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainToken, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION_PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts an AES-256-GCM encrypted Meta WABA access token.
 * Throws if tampered with or invalid.
 */
export function decryptAccessToken(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("Encrypted token payload is missing.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Invalid encrypted token format.");
  }

  const [, ivB64, tagB64, cipherB64] = parts;
  const key = deriveEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid IV or authentication tag length.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Validates Meta's X-Hub-Signature-256 header using HMAC-SHA256 and constant-time comparison.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  explicitAppSecret?: string
): boolean {
  const appSecret = (
    explicitAppSecret ||
    process.env.META_APP_SECRET ||
    ""
  ).trim();

  if (!appSecret || !signatureHeader) {
    return false;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const providedHex = signatureHeader.slice("sha256=".length).trim();
  if (!/^[0-9a-fA-F]{64}$/.test(providedHex)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const providedBuf = Buffer.from(providedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Constant-time verify_token comparison for GET /api/whatsapp/webhook hub challenge.
 */
export function verifyHubChallengeToken(
  providedToken: string | null,
  explicitVerifyToken?: string
): boolean {
  const configuredToken = (
    explicitVerifyToken ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    ""
  ).trim();

  if (!configuredToken || !providedToken) {
    return false;
  }

  const a = Buffer.from(providedToken, "utf8");
  const b = Buffer.from(configuredToken, "utf8");
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}
