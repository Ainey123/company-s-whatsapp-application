import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteObjectSafely } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { confirmed, category } = body;

    if (!confirmed) {
      return NextResponse.json(
        { error: "Explicit admin confirmation is required to perform permanent retention deletion." },
        { status: 400 }
      );
    }

    const policy = (await prisma.retentionPolicy.findFirst()) || {
      temporaryFileDays: 7,
      voiceRetentionDays: 90,
      callLogRetentionDays: 180,
      groupFileRetentionDays: 365,
    };

    const now = new Date();
    const tempCutoff = new Date(now.getTime() - policy.temporaryFileDays * 24 * 60 * 60 * 1000);
    const voiceCutoff = new Date(now.getTime() - policy.voiceRetentionDays * 24 * 60 * 60 * 1000);
    const callLogCutoff = new Date(now.getTime() - policy.callLogRetentionDays * 24 * 60 * 60 * 1000);
    const groupFileCutoff = new Date(now.getTime() - policy.groupFileRetentionDays * 24 * 60 * 60 * 1000);

    let messagesToPurge: any[] = [];
    let callLogsCount = 0;

    // Purge temporary files
    if (!category || category === "all" || category === "temp") {
      const tempFiles = await prisma.message.findMany({
        where: {
          isTemporary: true,
          fileUrl: { not: null },
          isImportant: false,
          conversation: { isImportant: false },
          createdAt: { lt: tempCutoff },
        },
      });
      messagesToPurge.push(...tempFiles);
    }

    // Purge voice messages
    if (!category || category === "all" || category === "voice") {
      const voiceFiles = await prisma.message.findMany({
        where: {
          type: "VOICE",
          fileUrl: { not: null },
          isImportant: false,
          isTemporary: false,
          conversation: { isImportant: false },
          createdAt: { lt: voiceCutoff },
        },
      });
      messagesToPurge.push(...voiceFiles);
    }

    // Purge group files
    if (!category || category === "all" || category === "group") {
      const groupFiles = await prisma.message.findMany({
        where: {
          fileUrl: { not: null },
          conversation: { isGroup: true, isImportant: false },
          isImportant: false,
          isTemporary: false,
          type: { not: "VOICE" },
          createdAt: { lt: groupFileCutoff },
        },
      });
      messagesToPurge.push(...groupFiles);
    }

    // Purge call logs
    if (!category || category === "all" || category === "callLogs") {
      const deletedLogs = await prisma.callLog.deleteMany({
        where: {
          startedAt: { lt: callLogCutoff },
        },
      });
      callLogsCount = deletedLogs.count;
    }

    let freedBytes = 0;
    let filesRemovedFromStorage = 0;

    // Process each message file safely
    for (const msg of messagesToPurge) {
      freedBytes += msg.fileSize || 0;

      // Safely delete from Cloudflare R2 / Disk (with deduplication check)
      const res = await deleteObjectSafely(msg.fileKey, msg.fileUrl);
      if (res.deleted) {
        filesRemovedFromStorage += 1;
      }

      // Update message metadata: remove file references while preserving message flow
      await prisma.message.update({
        where: { id: msg.id },
        data: {
          fileUrl: null,
          fileName: null,
          fileSize: null,
          fileKey: null,
          thumbnailUrl: null,
          content: msg.content
            ? `${msg.content}\n[Media purged by retention policy]`
            : "[Media attachment purged by automatic retention policy]",
        },
      });
    }

    const totalItemsPurged = messagesToPurge.length + callLogsCount;

    // Record Audit Log
    await prisma.storageAuditLog.create({
      data: {
        action: "RETENTION_POLICY_PURGE",
        itemsPurged: totalItemsPurged,
        bytesFreed: freedBytes,
        executedById: currentUser.id,
        details: JSON.stringify({
          category: category || "all",
          messagesPurged: messagesToPurge.length,
          filesRemovedFromStorage,
          callLogsPurged: callLogsCount,
          tempCutoff: tempCutoff.toISOString(),
          voiceCutoff: voiceCutoff.toISOString(),
          callLogCutoff: callLogCutoff.toISOString(),
          groupFileCutoff: groupFileCutoff.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Retention purge completed successfully. Freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB across ${totalItemsPurged} items.`,
      freedBytes,
      freedMB: Number((freedBytes / (1024 * 1024)).toFixed(2)),
      itemsPurged: totalItemsPurged,
      filesRemovedFromStorage,
      callLogsPurged: callLogsCount,
    });
  } catch (error: any) {
    console.error("Execute retention error:", error);
    return NextResponse.json({ error: error.message || "Failed to execute retention purge" }, { status: 500 });
  }
}
