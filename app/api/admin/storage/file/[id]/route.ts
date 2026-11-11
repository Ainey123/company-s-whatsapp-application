import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteObjectSafely } from "@/lib/storage";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Admin required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        sender: { select: { displayName: true } },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message/file record not found" }, { status: 404 });
    }

    if (!message.fileUrl && !message.fileKey) {
      return NextResponse.json({ error: "Message does not contain an attachment" }, { status: 400 });
    }

    if (message.isImportant && !force) {
      return NextResponse.json(
        { error: "This file is marked as Important. Admin force confirmation is required to delete." },
        { status: 409 }
      );
    }

    const fileSize = message.fileSize || 0;
    const fileName = message.fileName || "unnamed_file";
    const fileKey = message.fileKey || "";
    const fileUrl = message.fileUrl || "";

    // Safely delete from Cloudflare R2 or local disk
    const deleteResult = await deleteObjectSafely(fileKey, fileUrl);

    // Update message record
    await prisma.message.update({
      where: { id },
      data: {
        fileUrl: null,
        fileName: null,
        fileSize: null,
        fileKey: null,
        thumbnailUrl: null,
        content: message.content
          ? `${message.content}\n[Attachment deleted for storage optimization]`
          : "[Attachment deleted by Admin for storage management]",
      },
    });

    // Record audit log
    await prisma.storageAuditLog.create({
      data: {
        action: "SINGLE_FILE_DELETED",
        itemsPurged: 1,
        bytesFreed: fileSize,
        executedById: currentUser.id,
        details: JSON.stringify({
          messageId: id,
          fileName,
          fileKey,
          uploader: message.sender.displayName,
          r2Deleted: deleteResult.deleted,
          reason: deleteResult.reason,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "File successfully purged from storage",
      bytesFreed: fileSize,
      storageResult: deleteResult,
    });
  } catch (error: any) {
    console.error("Delete file error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete file" }, { status: 500 });
  }
}
