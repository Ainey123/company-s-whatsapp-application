import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { isR2Configured } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;
    const fileKey = Array.isArray(key) ? key.join("/") : key;

    if (!fileKey) {
      return NextResponse.json({ error: "File key required" }, { status: 400 });
    }

    if (!isR2Configured) {
      return NextResponse.json({ error: "Object storage not configured" }, { status: 404 });
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });

    const command = new GetObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || "connectpro-media",
      Key: fileKey,
    });

    const response = await s3.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stream = response.Body.transformToWebStream();

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Type": response.ContentType || "application/octet-stream",
        "Content-Length": response.ContentLength ? String(response.ContentLength) : "",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("Media fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch file from object storage" }, { status: 404 });
  }
}
