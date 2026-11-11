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

    const [tempFiles, voiceFiles, groupFiles, callLogs] = await Promise.all([
      prisma.message.findMany({
        where: {
          isTemporary: true,
          fileUrl: { not: null },
          isImportant: false,
          conversation: { isImportant: false },
          createdAt: { lt: tempCutoff },
        },
        include: {
          sender: { select: { displayName: true, email: true } },
          conversation: { select: { id: true, name: true } },
        },
      }),
      prisma.message.findMany({
        where: {
          type: "VOICE",
          fileUrl: { not: null },
          isImportant: false,
          isTemporary: false,
          conversation: { isImportant: false },
          createdAt: { lt: voiceCutoff },
        },
        include: {
          sender: { select: { displayName: true, email: true } },
          conversation: { select: { id: true, name: true } },
        },
      }),
      prisma.message.findMany({
        where: {
          fileUrl: { not: null },
          conversation: { isGroup: true, isImportant: false },
          isImportant: false,
          isTemporary: false,
          type: { not: "VOICE" },
          createdAt: { lt: groupFileCutoff },
        },
        include: {
          sender: { select: { displayName: true, email: true } },
          conversation: { select: { id: true, name: true } },
        },
      }),
      prisma.callLog.findMany({
        where: {
          startedAt: { lt: callLogCutoff },
        },
        include: {
          caller: { select: { displayName: true } },
          receiver: { select: { displayName: true } },
        },
      }),
    ]);

    const backupData = {
      exportedAt: now.toISOString(),
      exportedBy: currentUser.displayName,
      policySnapshot: policy,
      counts: {
        temporaryFiles: tempFiles.length,
        voiceMessages: voiceFiles.length,
        groupFiles: groupFiles.length,
        callLogs: callLogs.length,
      },
      records: {
        temporaryFiles: tempFiles,
        voiceMessages: voiceFiles,
        groupFiles: groupFiles,
        callLogs: callLogs,
      },
    };

    const jsonString = JSON.stringify(backupData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="connectpro-retention-backup-${now.toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Backup export error:", error);
    return NextResponse.json({ error: error.message || "Failed to export backup" }, { status: 500 });
  }
}
