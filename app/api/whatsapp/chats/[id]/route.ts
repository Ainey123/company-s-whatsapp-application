import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isWithin24HourServiceWindow } from "@/lib/whatsapp-service";

/**
 * GET /api/whatsapp/chats/[id]
 * Returns full chat metadata, ordered messages (with employee sender attribution),
 * and internal employee notes. Marks unread inbound messages as read when opened.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const chat = await prisma.whatsAppChat.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            displayPhoneNumber: true,
            verifiedName: true,
            status: true,
            coexistenceEnabled: true,
            lastEchoAt: true,
          },
        },
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
        messages: {
          orderBy: { waTimestamp: "asc" },
          include: {
            sentBy: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                role: true,
                department: true,
              },
            },
          },
        },
        notes: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                role: true,
                department: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "WhatsApp chat not found" }, { status: 404 });
    }

    // Clear unread badge when employee opens the thread
    if (chat.unreadCount > 0) {
      await prisma.whatsAppChat.update({
        where: { id: chat.id },
        data: { unreadCount: 0 },
      });
    }

    return NextResponse.json({
      chat: {
        ...chat,
        unreadCount: 0,
        serviceWindow: isWithin24HourServiceWindow(chat.lastCustomerMsgAt),
      },
    });
  } catch (err: any) {
    console.error("GET /api/whatsapp/chats/[id] error:", err.message);
    return NextResponse.json(
      { error: "Failed to load WhatsApp conversation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/whatsapp/chats/[id]
 * Updates employee assignment (claim/reassign/unassign), chat status (OPEN, PENDING, RESOLVED),
 * or pin/archive flags, with optimistic version concurrency check and audit logging.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { assignedToUserId, status, isPinned, isArchived, expectedVersion } = body;

    const existing = await prisma.whatsAppChat.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "WhatsApp chat not found" }, { status: 404 });
    }

    if (
      typeof expectedVersion === "number" &&
      existing.version !== expectedVersion
    ) {
      return NextResponse.json(
        {
          error:
            "Collision detected: another employee or physical phone action just updated this conversation. Please refresh.",
          currentVersion: existing.version,
        },
        { status: 409 }
      );
    }

    const updateData: any = {
      version: { increment: 1 },
    };

    if (assignedToUserId !== undefined) {
      updateData.assignedToUserId = assignedToUserId || null;
    }
    if (typeof status === "string" && ["OPEN", "PENDING", "RESOLVED"].includes(status)) {
      updateData.status = status;
    }
    if (typeof isPinned === "boolean") {
      updateData.isPinned = isPinned;
    }
    if (typeof isArchived === "boolean") {
      updateData.isArchived = isArchived;
    }

    const updated = await prisma.whatsAppChat.update({
      where: { id },
      data: updateData,
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
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "WHATSAPP_CHAT_UPDATED",
        details: `Updated WhatsApp chat ${existing.customerPhone}: assignedTo=${updated.assignedTo?.displayName || "Unassigned"}, status=${updated.status}`,
      },
    });

    return NextResponse.json({ chat: updated });
  } catch (err: any) {
    console.error("PATCH /api/whatsapp/chats/[id] error:", err.message);
    return NextResponse.json(
      { error: "Failed to update WhatsApp chat" },
      { status: 500 }
    );
  }
}
