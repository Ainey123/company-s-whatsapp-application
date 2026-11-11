import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let policy = await prisma.retentionPolicy.findFirst();
    if (!policy) {
      policy = await prisma.retentionPolicy.create({
        data: {
          temporaryFileDays: 7,
          voiceRetentionDays: 90,
          callLogRetentionDays: 180,
          groupFileRetentionDays: 365,
          storageQuotaBytes: 50 * 1024 * 1024 * 1024, // 50 GB
          warningThreshold: 70,
          criticalThreshold: 85,
          emergencyThreshold: 95,
          autoPurgeEnabled: false,
        },
      });
    }

    return NextResponse.json({ policy });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to get policy" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      temporaryFileDays = 7,
      voiceRetentionDays = 90,
      callLogRetentionDays = 180,
      groupFileRetentionDays = 365,
      storageQuotaBytes = 50 * 1024 * 1024 * 1024,
      warningThreshold = 70,
      criticalThreshold = 85,
      emergencyThreshold = 95,
      autoPurgeEnabled = false,
    } = body;

    let policy = await prisma.retentionPolicy.findFirst();
    if (!policy) {
      policy = await prisma.retentionPolicy.create({
        data: {
          temporaryFileDays: Number(temporaryFileDays),
          voiceRetentionDays: Number(voiceRetentionDays),
          callLogRetentionDays: Number(callLogRetentionDays),
          groupFileRetentionDays: Number(groupFileRetentionDays),
          storageQuotaBytes: Number(storageQuotaBytes),
          warningThreshold: Number(warningThreshold),
          criticalThreshold: Number(criticalThreshold),
          emergencyThreshold: Number(emergencyThreshold),
          autoPurgeEnabled: Boolean(autoPurgeEnabled),
        },
      });
    } else {
      policy = await prisma.retentionPolicy.update({
        where: { id: policy.id },
        data: {
          temporaryFileDays: Number(temporaryFileDays),
          voiceRetentionDays: Number(voiceRetentionDays),
          callLogRetentionDays: Number(callLogRetentionDays),
          groupFileRetentionDays: Number(groupFileRetentionDays),
          storageQuotaBytes: Number(storageQuotaBytes),
          warningThreshold: Number(warningThreshold),
          criticalThreshold: Number(criticalThreshold),
          emergencyThreshold: Number(emergencyThreshold),
          autoPurgeEnabled: Boolean(autoPurgeEnabled),
        },
      });
    }

    // Record audit log for policy change
    await prisma.storageAuditLog.create({
      data: {
        action: "POLICY_UPDATED",
        itemsPurged: 0,
        bytesFreed: 0,
        executedById: currentUser.id,
        details: JSON.stringify({
          temporaryFileDays,
          voiceRetentionDays,
          callLogRetentionDays,
          groupFileRetentionDays,
          storageQuotaBytes,
          autoPurgeEnabled,
        }),
      },
    });

    return NextResponse.json({ success: true, policy });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update policy" }, { status: 500 });
  }
}
