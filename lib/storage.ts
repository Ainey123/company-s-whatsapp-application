import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";

// Optional dynamic import of sharp for resilient image processing
let sharp: any = null;
try {
  sharp = require("sharp");
} catch (e) {
  console.warn("Sharp is not available. Image compression will use original file.");
}

// Cloudflare R2 S3-Compatible Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || "connectpro-media";
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";

export const isR2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);

// Singleton S3 client configured for Cloudflare R2
const r2Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY!,
        secretAccessKey: R2_SECRET_KEY!,
      },
    })
  : null;

export interface UploadResult {
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string | null;
  storageType: "CLOUDFLARE_R2" | "LOCAL_DISK";
}

/**
 * Compress an image buffer and generate a thumbnail using sharp
 */
export async function processImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ compressedBuffer: Buffer; thumbnailBuffer: Buffer | null; newMime: string }> {
  if (!sharp || !mimeType.startsWith("image/")) {
    return { compressedBuffer: buffer, thumbnailBuffer: null, newMime: mimeType };
  }

  try {
    // Compress main image to WebP with 82% quality (saves ~60-80% bandwidth)
    const compressedBuffer = await sharp(buffer)
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    // Generate lightweight thumbnail (max 320x320)
    const thumbnailBuffer = await sharp(buffer)
      .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    return { compressedBuffer, thumbnailBuffer, newMime: "image/webp" };
  } catch (err) {
    console.error("Image processing error, falling back to original:", err);
    return { compressedBuffer: buffer, thumbnailBuffer: null, newMime: mimeType };
  }
}

/**
 * Upload a file to Cloudflare R2 or local storage
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  rawMimeType: string,
  type: string = "DOCUMENT"
): Promise<UploadResult> {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  
  let finalBuffer = buffer;
  let finalMime = rawMimeType || "application/octet-stream";
  let thumbBuffer: Buffer | null = null;

  // Process images
  if (type === "IMAGE" || rawMimeType.startsWith("image/")) {
    const processed = await processImage(buffer, rawMimeType);
    finalBuffer = processed.compressedBuffer;
    finalMime = processed.newMime;
    thumbBuffer = processed.thumbnailBuffer;
  }

  const ext = finalMime === "image/webp" ? ".webp" : path.extname(originalName) || (type === "VOICE" ? ".webm" : ".bin");
  const baseKey = `media/${new Date().toISOString().slice(0, 7)}/${timestamp}-${randomStr}`;
  const fileKey = `${baseKey}${ext}`;
  const thumbKey = thumbBuffer ? `${baseKey}-thumb.webp` : null;

  // 1. Upload to Cloudflare R2 if configured
  if (isR2Configured && r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileKey,
        Body: finalBuffer,
        ContentType: finalMime,
        Metadata: {
          originalName: encodeURIComponent(originalName),
          type,
        },
      })
    );

    let thumbnailUrl: string | null = null;
    if (thumbBuffer && thumbKey) {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: "image/webp",
        })
      );
      thumbnailUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL.replace(/\/$/, "")}/${thumbKey}` : `/api/media/${thumbKey}`;
    }

    const fileUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL.replace(/\/$/, "")}/${fileKey}` : `/api/media/${fileKey}`;

    return {
      fileUrl,
      fileKey,
      fileName: originalName,
      fileSize: finalBuffer.length,
      mimeType: finalMime,
      thumbnailUrl,
      storageType: "CLOUDFLARE_R2",
    };
  }

  // 2. Fallback to Local Disk storage
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const safeFilename = `${timestamp}-${randomStr}${ext}`;
  const localFilePath = path.join(uploadsDir, safeFilename);
  fs.writeFileSync(localFilePath, finalBuffer);

  let thumbnailUrl: string | null = null;
  if (thumbBuffer) {
    const thumbFilename = `${timestamp}-${randomStr}-thumb.webp`;
    fs.writeFileSync(path.join(uploadsDir, thumbFilename), thumbBuffer);
    thumbnailUrl = `/uploads/${thumbFilename}`;
  }

  return {
    fileUrl: `/uploads/${safeFilename}`,
    fileKey: safeFilename,
    fileName: originalName,
    fileSize: finalBuffer.length,
    mimeType: finalMime,
    thumbnailUrl,
    storageType: "LOCAL_DISK",
  };
}

/**
 * Generate a presigned upload URL for direct client-to-R2 uploads
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string } | null> {
  if (!isR2Configured || !r2Client) return null;

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const ext = path.extname(filename) || ".bin";
  const fileKey = `media/${new Date().toISOString().slice(0, 7)}/${timestamp}-${randomStr}${ext}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
  const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL.replace(/\/$/, "")}/${fileKey}` : `/api/media/${fileKey}`;

  return {
    uploadUrl,
    fileKey,
    publicUrl,
  };
}

/**
 * Safely delete an object from Cloudflare R2 or local disk with deduplication check
 */
export async function deleteObjectSafely(fileKey: string, fileUrl?: string): Promise<{ deleted: boolean; reason?: string }> {
  if (!fileKey && !fileUrl) return { deleted: false, reason: "No file key or URL provided" };

  try {
    // 1. Safety check: ensure file is not still referenced by other active messages (e.g. forwarded)
    const referenceCount = await prisma.message.count({
      where: {
        OR: [
          ...(fileKey ? [{ fileKey }] : []),
          ...(fileUrl ? [{ fileUrl }] : []),
        ],
        isDeleted: false,
      },
    });

    if (referenceCount > 1) {
      return { deleted: false, reason: "File is still referenced by other conversations/messages" };
    }

    // 2. Delete from Cloudflare R2 if it's an R2 key or URL
    if (isR2Configured && r2Client && (fileKey.startsWith("media/") || fileUrl?.includes("r2."))) {
      const targetKey = fileKey.startsWith("media/") ? fileKey : fileUrl?.split("/").pop() || fileKey;
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: targetKey,
        })
      );
      return { deleted: true };
    }

    // 3. Delete from Local disk
    const filename = path.basename(fileKey || fileUrl || "");
    const localPath = path.join(process.cwd(), "public", "uploads", filename);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    return { deleted: true };
  } catch (err: any) {
    console.error("Error deleting file:", err);
    return { deleted: false, reason: err.message };
  }
}
