import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify membership
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: currentUser.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor"); // message id
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "30", 10), 5), 100);

    // Optimized cursor-based pagination
    // If cursor is provided, we fetch messages older than the cursor message
    let cursorCondition: any = {};
    if (cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });

      if (cursorMessage) {
        cursorCondition = {
          createdAt: {
            lt: cursorMessage.createdAt,
          },
        };
      }
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...cursorCondition,
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            designation: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: {
              select: { displayName: true },
            },
          },
        },
        receipts: {
          select: {
            userId: true,
            status: true,
            readAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    // Reverse to return in chronological order for UI rendering
    const chronologicalMessages = [...items].reverse();
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Mark unread messages as read and reset unread count when reading latest messages
    if (!cursor && membership.unreadCount > 0) {
      await prisma.conversationMember.update({
        where: { id: membership.id },
        data: { unreadCount: 0 },
      });

      // Update receipts
      const unreadMessageIds = chronologicalMessages
        .filter((m) => m.senderId !== currentUser.id)
        .map((m) => m.id);

      for (const msgId of unreadMessageIds) {
        await prisma.messageReceipt.upsert({
          where: {
            messageId_userId: {
              messageId: msgId,
              userId: currentUser.id,
            },
          },
          update: {
            status: "READ",
            readAt: new Date(),
          },
          create: {
            messageId: msgId,
            userId: currentUser.id,
            status: "READ",
            readAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      messages: chronologicalMessages,
      nextCursor,
      hasMore,
    });
  } catch (error: any) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: error.message || "Failed to load messages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const isMember = conversation.members.some((m) => m.userId === currentUser.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const body = await req.json();
    const {
      content,
      type = "TEXT",
      fileUrl,
      fileName,
      fileSize,
      fileKey,
      mimeType,
      thumbnailUrl,
      isTemporary = false,
      isImportant = false,
      replyToId,
    } = body;

    if (!content && !fileUrl) {
      return NextResponse.json({ error: "Message content or file required" }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: currentUser.id,
        content: content || "",
        type,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize ? Number(fileSize) : null,
        fileKey: fileKey || null,
        mimeType: mimeType || null,
        thumbnailUrl: thumbnailUrl || null,
        isTemporary: Boolean(isTemporary),
        isImportant: Boolean(isImportant),
        replyToId: replyToId || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            designation: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: {
              select: { displayName: true },
            },
          },
        },
        receipts: true,
      },
    });

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    // Increment unread count for other members
    const otherMembers = conversation.members.filter((m) => m.userId !== currentUser.id);
    for (const m of otherMembers) {
      await prisma.conversationMember.update({
        where: { id: m.id },
        data: { unreadCount: { increment: 1 } },
      });
    }

    // Prepare socket broadcast payload
    const recipientIds = otherMembers.map((m) => m.userId);
    const messagePayload = {
      ...message,
      recipientIds,
    };

    // If global socket.io server instance exists
    if ((global as any).io) {
      const io = (global as any).io;
      io.to(`conv:${id}`).emit("new_message", messagePayload);
      recipientIds.forEach((rId) => {
        io.to(`user:${rId}`).emit("message_notification", messagePayload);
      });
    }

    return NextResponse.json({ message: messagePayload }, { status: 201 });
  } catch (error: any) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
