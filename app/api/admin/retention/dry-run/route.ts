import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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

    // 1. Temporary files eligible for purge
    const tempFilesEligible = await prisma.message.findMany({
      where: {
        isTemporary: true,
        fileUrl: { not: null },
        isImportant: false,
        conversation: { isImportant: false },
        createdAt: { lt: tempCutoff },
      },
      select: { id: true, fileName: true, fileSize: true, createdAt: true },
    });

    // 2. Voice messages eligible for purge
    const voiceEligible = await prisma.message.findMany({
      where: {
        type: "VOICE",
        fileUrl: { not: null },
        isImportant: false,
        isTemporary: false,
        conversation: { isImportant: false },
        createdAt: { lt: voiceCutoff },
      },
      select: { id: true, fileName: true, fileSize: true, createdAt: true },
    });

    // 3. Old Call Logs eligible for purge
    const callLogsEligible = await prisma.callLog.findMany({
      where: {
        startedAt: { lt: callLogCutoff },
      },
      select: { id: true, startedAt: true },
    });

    // 4. Old Group media files eligible for purge
    const groupFilesEligible = await prisma.message.findMany({
      where: {
        fileUrl: { not: null },
        conversation: { isGroup: true, isImportant: false },
        isImportant: false,
        isTemporary: false,
        type: { not: "VOICE" },
        createdAt: { lt: groupFileCutoff },
      },
      select: { id: true, fileName: true, fileSize: true, createdAt: true },
    });

    const sumBytes = (items: { fileSize: number | null }[]) =>
      items.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);

    const tempBytes = sumBytes(tempFilesEligible);
    const voiceBytes = sumBytes(voiceEligible);
    const groupBytes = sumBytes(groupFilesEligible);
    const callLogEstimatedBytes = callLogsEligible.length * 256;

    const totalPurgeableBytes = tempBytes + voiceBytes + groupBytes + callLogEstimatedBytes;
    const totalPurgeableItems =
      tempFilesEligible.length + voiceEligible.length + groupFilesEligible.length + callLogsEligible.length;

    return NextResponse.json({
      summary: {
        totalPurgeableItems,
        totalPurgeableBytes,
        totalPurgeableMB: Number((totalPurgeableBytes / (1024 * 1024)).toFixed(2)),
      },
      categories: {
        temporaryFiles: {
          days: policy.temporaryFileDays,
          count: tempFilesEligible.length,
          bytes: tempBytes,
        },
        voiceMessages: {
          days: policy.voiceRetentionDays,
          count: voiceEligible.length,
          bytes: voiceBytes,
        },
        groupFiles: {
          days: policy.groupFileRetentionDays,
          count: groupFilesEligible.length,
          bytes: groupBytes,
        },
        callLogs: {
          days: policy.callLogRetentionDays,
          count: callLogsEligible.length,
          bytes: callLogEstimatedBytes,
        },
      },
      protected: {
        textMessagesProtected: "100% - Never automatically deleted",
        importantMessagesProtected: "100% - Protected by policy",
        importantConversationsProtected: "100% - Protected by policy",
      },
    });
  } catch (error: any) {
    console.error("Retention dry-run error:", error);
    return NextResponse.json({ error: error.message || "Failed to run retention analysis" }, { status: 500 });
  }
}
