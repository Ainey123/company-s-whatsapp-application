import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "DOCUMENT";
    const isTemporary = formData.get("isTemporary") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Configurable size limit: e.g. 50MB for general uploads
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds maximum size limit (50MB). For larger files, please request a direct upload URL." },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResult = await uploadFile(
      buffer,
      file.name || "attachment",
      file.type || "application/octet-stream",
      type
    );

    return NextResponse.json({
      success: true,
      fileUrl: uploadResult.fileUrl,
      fileKey: uploadResult.fileKey,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      mimeType: uploadResult.mimeType,
      thumbnailUrl: uploadResult.thumbnailUrl,
      storageType: uploadResult.storageType,
      type,
      isTemporary,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
