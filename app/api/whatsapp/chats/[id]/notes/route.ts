import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/whatsapp/chats/[id]/notes
 * Creates an internal employee team note on a WhatsApp conversation thread.
 * Internal notes are stored in WhatsAppInternalNote and NEVER sent to the external WhatsApp customer.
 */
export async function POST(
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
    const content = (body.content || "").trim();

    if (!content) {
      return NextResponse.json(
        { error: "Internal note content cannot be empty" },
        { status: 400 }
      );
    }

    const chat = await prisma.whatsAppChat.findUnique({
      where: { id },
    });

    if (!chat) {
      return NextResponse.json({ error: "WhatsApp chat not found" }, { status: 404 });
    }

    const note = await prisma.whatsAppInternalNote.create({
      data: {
        chatId: chat.id,
        authorId: currentUser.id,
        content,
      },
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
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "WHATSAPP_INTERNAL_NOTE_ADDED",
        details: `Added internal note on WhatsApp chat ${chat.customerPhone}`,
      },
    });

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/whatsapp/chats/[id]/notes error:", err.message);
    return NextResponse.json(
      { error: "Failed to save internal note" },
      { status: 500 }
    );
  }
}
