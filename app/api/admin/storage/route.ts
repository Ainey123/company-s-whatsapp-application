import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isR2Configured } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Access denied. Admin required." }, { status: 403 });
    }

    // 1. Get or create retention policy
    let policy = await prisma.retentionPolicy.findFirst();
    if (!policy) {
      policy = await prisma.retentionPolicy.create({
        data: {
          temporaryFileDays: 7,
          voiceRetentionDays: 90,
          callLogRetentionDays: 180,
          groupFileRetentionDays: 365,
          storageQuotaBytes: 50 * 1024 * 1024 * 1024, // 50 GB default quota
          warningThreshold: 70,
          criticalThreshold: 85,
          emergencyThreshold: 95,
          autoPurgeEnabled: false,
        },
      });
    }

    // 2. Compute Real Database Counts & Estimated DB Footprint
    const [
      totalUsers,
      totalConversations,
      totalMessages,
      totalCallLogs,
      totalAuditLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.callLog.count(),
      prisma.storageAuditLog.count(),
    ]);

    // Average row size approximations for PostgreSQL/SQLite
    const estimatedDbBytes =
      totalUsers * 1024 + // ~1KB per user
      totalConversations * 512 + // ~512B per conversation
      totalMessages * 640 + // ~640B per message
      totalCallLogs * 256 + // ~256B per call log
      totalAuditLogs * 384; // ~384B per audit log

    // 3. Media Storage Totals
    const mediaAggregation = await prisma.message.aggregate({
      where: {
        fileUrl: { not: null },
      },
      _sum: {
        fileSize: true,
      },
      _count: {
        id: true,
      },
    });

    const totalMediaBytes = mediaAggregation._sum.fileSize || 0;
    const totalMediaFiles = mediaAggregation._count.id || 0;

    // 4. Breakdown by Type (Image, Video, Audio/Voice, Document)
    const [imageStats, videoStats, voiceStats, docStats] = await Promise.all([
      prisma.message.aggregate({
        where: { type: "IMAGE", fileUrl: { not: null } },
        _sum: { fileSize: true },
        _count: { id: true },
      }),
      prisma.message.aggregate({
        where: { type: "VIDEO", fileUrl: { not: null } },
        _sum: { fileSize: true },
        _count: { id: true },
      }),
      prisma.message.aggregate({
        where: { type: "VOICE", fileUrl: { not: null } },
        _sum: { fileSize: true },
        _count: { id: true },
      }),
      prisma.message.aggregate({
        where: { type: "DOCUMENT", fileUrl: { not: null } },
        _sum: { fileSize: true },
        _count: { id: true },
      }),
    ]);

    const mediaByType = {
      image: { count: imageStats._count.id, bytes: imageStats._sum.fileSize || 0 },
      video: { count: videoStats._count.id, bytes: videoStats._sum.fileSize || 0 },
      voice: { count: voiceStats._count.id, bytes: voiceStats._sum.fileSize || 0 },
      document: { count: docStats._count.id, bytes: docStats._sum.fileSize || 0 },
    };

    // 5. Largest Files (Top 15)
    const largestFiles = await prisma.message.findMany({
      where: {
        fileUrl: { not: null },
        fileSize: { gt: 0 },
      },
      orderBy: { fileSize: "desc" },
      take: 15,
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileKey: true,
        fileSize: true,
        mimeType: true,
        type: true,
        createdAt: true,
        isImportant: true,
        sender: {
          select: {
            id: true,
            displayName: true,
            email: true,
            department: true,
          },
        },
        conversation: {
          select: {
            id: true,
            name: true,
            isGroup: true,
          },
        },
      },
    });

    // 6. Storage Usage By User (Top 10 uploaders)
    const topUploadersGroup = await prisma.message.groupBy({
      by: ["senderId"],
      where: {
        fileUrl: { not: null },
        fileSize: { gt: 0 },
      },
      _sum: {
        fileSize: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          fileSize: "desc",
        },
      },
      take: 10,
    });

    const userIds = topUploadersGroup.map((g) => g.senderId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, email: true, department: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const usageByUser = topUploadersGroup.map((g) => {
      const u = userMap.get(g.senderId);
      return {
        userId: g.senderId,
        userName: u?.displayName || "Unknown",
        email: u?.email || "",
        department: u?.department || "General",
        fileCount: g._count.id,
        bytes: g._sum.fileSize || 0,
      };
    });

    // 7. Storage Usage By Department
    const departmentMap: Record<string, { bytes: number; count: number }> = {};
    for (const item of usageByUser) {
      const dept = item.department || "General";
      if (!departmentMap[dept]) {
        departmentMap[dept] = { bytes: 0, count: 0 };
      }
      departmentMap[dept].bytes += item.bytes;
      departmentMap[dept].count += item.fileCount;
    }
    const usageByDepartment = Object.entries(departmentMap).map(([department, data]) => ({
      department,
      bytes: data.bytes,
      fileCount: data.count,
    }));

    // 8. Monthly Upload Statistics (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentFileMessages = await prisma.message.findMany({
      where: {
        fileUrl: { not: null },
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
        fileSize: true,
      },
    });

    const monthlyMap: Record<string, { bytes: number; count: number }> = {};
    for (const msg of recentFileMessages) {
      const monthKey = msg.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { bytes: 0, count: 0 };
      }
      monthlyMap[monthKey].bytes += msg.fileSize || 0;
      monthlyMap[monthKey].count += 1;
    }

    const monthlyStats = Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        bytes: data.bytes,
        count: data.count,
      }));

    // 9. Quota and Thresholds calculation
    const quotaBytes = policy.storageQuotaBytes || 50 * 1024 * 1024 * 1024;
    const totalStorageBytes = totalMediaBytes + estimatedDbBytes;
    const usagePercentage = quotaBytes > 0 ? (totalStorageBytes / quotaBytes) * 100 : 0;

    let warningLevel: "NORMAL" | "WARNING_70" | "CRITICAL_85" | "DANGER_95" = "NORMAL";
    if (usagePercentage >= policy.emergencyThreshold) {
      warningLevel = "DANGER_95";
    } else if (usagePercentage >= policy.criticalThreshold) {
      warningLevel = "CRITICAL_85";
    } else if (usagePercentage >= policy.warningThreshold) {
      warningLevel = "WARNING_70";
    }

    // 10. Audit logs (recent 10)
    const recentAuditLogs = await prisma.storageAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      database: {
        estimatedDbBytes,
        totalUsers,
        totalConversations,
        totalMessages,
        totalCallLogs,
      },
      media: {
        totalMediaBytes,
        totalMediaFiles,
        isR2Configured,
        mediaByType,
      },
      quota: {
        quotaBytes,
        quotaMB: Number((quotaBytes / (1024 * 1024)).toFixed(0)),
        totalStorageBytes,
        usagePercentage: Number(usagePercentage.toFixed(2)),
        warningLevel,
        thresholds: {
          t1: policy.warningThreshold,
          t2: policy.criticalThreshold,
          t3: policy.emergencyThreshold,
        },
      },
      policy,
      largestFiles,
      usageByUser,
      usageByDepartment,
      monthlyStats,
      recentAuditLogs,
    });
  } catch (error: any) {
    console.error("Storage overview error:", error);
    return NextResponse.json({ error: error.message || "Failed to load storage statistics" }, { status: 500 });
  }
}
