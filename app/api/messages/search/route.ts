import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Get user's conversation IDs
    const userMemberships = await prisma.conversationMember.findMany({
      where: { userId: currentUser.id },
      select: { conversationId: true },
    });

    const conversationIds = userMemberships.map((m) => m.conversationId);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        content: { contains: query },
        isDeleted: false,
      },
      include: {
        sender: {
          select: { id: true, displayName: true, avatar: true },
        },
        conversation: {
          select: {
            id: true,
            isGroup: true,
            name: true,
            members: {
              include: {
                user: { select: { id: true, displayName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return NextResponse.json({ results: messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Search failed" }, { status: 500 });
  }
}
