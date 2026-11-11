import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedUploadUrl, isR2Configured } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filename, contentType, fileSize } = body;

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Filename and contentType are required" }, { status: 400 });
    }

    // Direct upload allows up to 250MB
    const MAX_DIRECT_SIZE = 250 * 1024 * 1024;
    if (fileSize && fileSize > MAX_DIRECT_SIZE) {
      return NextResponse.json({ error: "File exceeds 250MB limit" }, { status: 413 });
    }

    if (!isR2Configured) {
      return NextResponse.json(
        { 
          configured: false, 
          message: "Cloudflare R2 is not configured on this environment. Fallback to standard multipart upload." 
        },
        { status: 200 }
      );
    }

    const presigned = await getPresignedUploadUrl(filename, contentType, 3600);
    if (!presigned) {
      return NextResponse.json({ error: "Failed to generate presigned upload URL" }, { status: 500 });
    }

    return NextResponse.json({
      configured: true,
      uploadUrl: presigned.uploadUrl,
      fileKey: presigned.fileKey,
      publicUrl: presigned.publicUrl,
    });
  } catch (error: any) {
    console.error("Presigned URL error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate presigned URL" }, { status: 500 });
  }
}
