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

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                phone: true,
                avatar: true,
                designation: true,
                department: true,
                role: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const myMembership = conversation.members.find((m) => m.userId === currentUser.id);
    if (!myMembership) {
      return NextResponse.json({ error: "Not a member of this conversation" }, { status: 403 });
    }

    // Shared media in conversation
    const sharedMedia = await prisma.message.findMany({
      where: {
        conversationId: id,
        isDeleted: false,
        type: { in: ["IMAGE", "VIDEO", "DOCUMENT", "AUDIO", "VOICE"] },
      },
      select: {
        id: true,
        type: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        sender: {
          select: { displayName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    let otherUser = null;
    if (!conversation.isGroup) {
      const otherMember = conversation.members.find((m) => m.userId !== currentUser.id);
      otherUser = otherMember ? otherMember.user : null;
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        isGroup: conversation.isGroup,
        name: conversation.isGroup ? conversation.name : otherUser?.displayName || "Direct Chat",
        description: conversation.description,
        avatar: conversation.isGroup ? conversation.avatar : otherUser?.avatar,
        otherUser,
        members: conversation.members,
        sharedMedia,
        isPinned: myMembership.isPinned,
        isArchived: myMembership.isArchived,
        isMuted: myMembership.isMuted,
        myRole: myMembership.role,
        createdAt: conversation.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, avatar, isPinned, isArchived, isMuted } = body;

    // Check membership
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: currentUser.id,
        },
      },
      include: {
        conversation: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Update user's personal chat preferences (pinned, archived, muted)
    const memberUpdates: any = {};
    if (isPinned !== undefined) memberUpdates.isPinned = isPinned;
    if (isArchived !== undefined) memberUpdates.isArchived = isArchived;
    if (isMuted !== undefined) memberUpdates.isMuted = isMuted;

    if (Object.keys(memberUpdates).length > 0) {
      await prisma.conversationMember.update({
        where: { id: membership.id },
        data: memberUpdates,
      });
    }

    // Update group info (name, description, avatar)
    const convUpdates: any = {};
    if (name && name.trim()) convUpdates.name = name.trim();
    if (description !== undefined) convUpdates.description = description ? description.trim() : null;
    if (avatar !== undefined) convUpdates.avatar = avatar;

    if (Object.keys(convUpdates).length > 0 && membership.conversation.isGroup) {
      const isGroupAdmin = membership.role === "ADMIN" || currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
      if (!isGroupAdmin) {
        return NextResponse.json({ error: "Only group admins can modify group details" }, { status: 403 });
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: convUpdates,
      });

      // Notify members via socket
      if ((global as any).io) {
        (global as any).io.to(`conv:${id}`).emit("group_info_updated", {
          conversationId: id,
          ...convUpdates,
        });
      }

      return NextResponse.json({ success: true, conversation: updated });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update conversation" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action"); // "leave" or "delete"

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const myMembership = conversation.members.find((m) => m.userId === currentUser.id);
    if (!myMembership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // If action is leave (or non-owner user leaving)
    if (action === "leave" || (!conversation.isGroup && myMembership)) {
      await prisma.conversationMember.delete({ where: { id: myMembership.id } });
      return NextResponse.json({ success: true, message: "Left conversation" });
    }

    // Deleting entire group: requires group admin or company admin
    const isCompanyAdmin = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
    const isGroupAdmin = conversation.isGroup && myMembership.role === "ADMIN";

    if (isCompanyAdmin || isGroupAdmin) {
      await prisma.conversation.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "Conversation deleted" });
    }

    // Regular member leaving
    await prisma.conversationMember.delete({ where: { id: myMembership.id } });
    return NextResponse.json({ success: true, message: "Left conversation" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
