import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const [
      totalUsers,
      activeUsers,
      totalGroups,
      totalMessages,
      totalCalls,
      usersByRole,
      usersByDept,
      messagesByType,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.conversation.count({ where: { isGroup: true } }),
      prisma.message.count(),
      prisma.callLog.count(),
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ["department"],
        _count: { id: true },
      }),
      prisma.message.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
    ]);

    // Calculate approximate storage usage
    const mediaFiles = await prisma.message.aggregate({
      where: { fileSize: { not: null } },
      _sum: { fileSize: true },
    });

    return NextResponse.json({
      metrics: {
        totalEmployees: totalUsers,
        activeEmployees: activeUsers,
        totalGroups,
        totalMessages,
        totalCalls,
        totalStorageBytes: mediaFiles._sum.fileSize || 0,
      },
      distribution: {
        byRole: usersByRole.map((r) => ({ role: r.role, count: r._count.id })),
        byDepartment: usersByDept.map((d) => ({
          department: d.department || "Unassigned",
          count: d._count.id,
        })),
        byMessageType: messagesByType.map((m) => ({
          type: m.type,
          count: m._count.id,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch stats" }, { status: 500 });
  }
}
