import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { isWithin24HourServiceWindow } from "@/lib/whatsapp-service";

/**
 * GET /api/whatsapp/chats
 * Lists synchronized WhatsApp customer chats for the multi-employee shared inbox.
 * Supports filtering by queue (ALL, UNASSIGNED, MINE), status (OPEN, PENDING, RESOLVED), and search.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseReady();
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queue = (searchParams.get("queue") || "ALL").toUpperCase();
    const statusFilter = (searchParams.get("status") || "ALL").toUpperCase();
    const search = (searchParams.get("search") || "").trim();

    const whereClause: any = {};

    if (queue === "UNASSIGNED") {
      whereClause.assignedToUserId = null;
    } else if (queue === "MINE") {
      whereClause.assignedToUserId = currentUser.id;
    }

    if (statusFilter !== "ALL") {
      whereClause.status = statusFilter;
    }

    if (search) {
      const isSqlite = (process.env.DATABASE_URL || "").startsWith("file:");
      const strFilter = isSqlite
        ? { contains: search }
        : { contains: search, mode: "insensitive" as const };
      whereClause.OR = [
        { customerName: strFilter },
        { customerPhone: strFilter },
        { customerWaId: strFilter },
        { lastMessagePreview: strFilter },
      ];
    }

    const chats = await prisma.whatsAppChat.findMany({
      where: whereClause,
      orderBy: [{ isPinned: "desc" }, { lastMessageAt: "desc" }],
      include: {
        assignedTo: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            department: true,
            role: true,
          },
        },
        _count: {
          select: {
            messages: true,
            notes: true,
          },
        },
      },
    });

    const formattedChats = chats.map((chat) => ({
      ...chat,
      serviceWindow: isWithin24HourServiceWindow(chat.lastCustomerMsgAt),
      messagesCount: chat._count.messages,
      notesCount: chat._count.notes,
    }));

    return NextResponse.json({ chats: formattedChats });
  } catch (err: any) {
    console.error("GET /api/whatsapp/chats error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch WhatsApp chats" },
      { status: 500 }
    );
  }
}
