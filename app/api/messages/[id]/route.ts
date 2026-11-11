import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.senderId !== currentUser.id) {
      return NextResponse.json({ error: "Can only edit your own messages" }, { status: 403 });
    }

    const { content } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: {
        content: content.trim(),
        isEdited: true,
      },
      include: {
        sender: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
    });

    if ((global as any).io) {
      (global as any).io.to(`conv:${updated.conversationId}`).emit("message_edited", updated);
    }

    return NextResponse.json({ message: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to edit message" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const body = await req.json();
    const { isImportant } = body;

    const updated = await prisma.message.update({
      where: { id },
      data: {
        ...(isImportant !== undefined ? { isImportant: Boolean(isImportant) } : {}),
      },
    });

    return NextResponse.json({ success: true, message: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update message" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id },
      include: { conversation: { include: { members: true } } },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const isSender = message.senderId === currentUser.id;
    const isCompanyAdmin = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
    const groupMember = message.conversation.members.find((m) => m.userId === currentUser.id);
    const isGroupAdmin = message.conversation.isGroup && groupMember?.role === "ADMIN";

    if (!isSender && !isCompanyAdmin && !isGroupAdmin) {
      return NextResponse.json({ error: "Unauthorized to delete this message" }, { status: 403 });
    }

    // Soft delete to preserve conversation flow
    const updated = await prisma.message.update({
      where: { id },
      data: {
        content: "This message was deleted",
        isDeleted: true,
      },
    });

    if ((global as any).io) {
      (global as any).io.to(`conv:${updated.conversationId}`).emit("message_deleted", {
        messageId: id,
        conversationId: updated.conversationId,
      });
    }

    return NextResponse.json({ success: true, message: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete message" }, { status: 500 });
  }
}
