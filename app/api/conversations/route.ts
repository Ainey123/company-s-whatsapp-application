import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Unified conversation formatter for client consistency
function formatConversation(conv: any, currentUserId: string) {
  const myMembership = conv.members?.find((m: any) => m.userId === currentUserId);
  let otherUser = null;

  if (!conv.isGroup) {
    const otherMember = conv.members?.find((mem: any) => mem.userId !== currentUserId);
    otherUser = otherMember ? otherMember.user : null;
  }

  const lastMessage = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;

  return {
    id: conv.id,
    isGroup: conv.isGroup,
    name: conv.isGroup ? conv.name : otherUser?.displayName || "Direct Chat",
    description: conv.description,
    avatar: conv.isGroup ? conv.avatar : otherUser?.avatar,
    otherUser,
    members: conv.members || [],
    lastMessage,
    lastMessageAt: conv.lastMessageAt || conv.createdAt,
    unreadCount: myMembership?.unreadCount || 0,
    isPinned: myMembership?.isPinned || false,
    isArchived: myMembership?.isArchived || false,
    isMuted: myMembership?.isMuted || false,
    myRole: myMembership?.role || "MEMBER",
    createdAt: conv.createdAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.conversationMember.findMany({
      where: { userId: currentUser.id },
      include: {
        conversation: {
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
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              include: {
                sender: {
                  select: { id: true, displayName: true },
                },
                receipts: true,
              },
            },
          },
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { conversation: { lastMessageAt: "desc" } },
      ],
    });

    const conversations = memberships.map((m) =>
      formatConversation(m.conversation, currentUser.id)
    );

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error("Get conversations error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { isGroup, recipientId, memberIds, name, description, avatar } = body;

    // 1-on-1 Direct Conversation
    if (!isGroup) {
      if (!recipientId) {
        return NextResponse.json({ error: "Recipient ID required" }, { status: 400 });
      }

      if (recipientId === currentUser.id) {
        return NextResponse.json({ error: "Cannot create conversation with yourself" }, { status: 400 });
      }

      // Check if 1-on-1 conversation already exists
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { members: { some: { userId: currentUser.id } } },
            { members: { some: { userId: recipientId } } },
          ],
        },
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
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: {
              sender: { select: { id: true, displayName: true } },
            },
          },
        },
      });

      if (existing) {
        const formatted = formatConversation(existing, currentUser.id);
        return NextResponse.json({ conversation: formatted, isExisting: true });
      }

      // Create new 1-on-1
      const newConv = await prisma.conversation.create({
        data: {
          isGroup: false,
          createdById: currentUser.id,
          members: {
            create: [
              { userId: currentUser.id, role: "MEMBER" },
              { userId: recipientId, role: "MEMBER" },
            ],
          },
        },
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
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: {
              sender: { select: { id: true, displayName: true } },
            },
          },
        },
      });

      const formatted = formatConversation(newConv, currentUser.id);

      // Notify recipient via socket
      if ((global as any).io) {
        const recipientFormatted = formatConversation(newConv, recipientId);
        (global as any).io.to(`user:${recipientId}`).emit("conversation_created", recipientFormatted);
      }

      return NextResponse.json({ conversation: formatted, isExisting: false }, { status: 201 });
    }

    // Group Conversation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const allMemberIds = Array.from(new Set([currentUser.id, ...(memberIds || [])]));

    const groupAvatar = avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name.trim())}`;

    const newGroup = await prisma.conversation.create({
      data: {
        isGroup: true,
        name: name.trim(),
        description: description?.trim() || null,
        avatar: groupAvatar,
        createdById: currentUser.id,
        members: {
          create: allMemberIds.map((uId) => ({
            userId: uId,
            role: uId === currentUser.id ? "ADMIN" : "MEMBER",
          })),
        },
      },
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
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    // Create system message welcoming group
    const initialMsg = await prisma.message.create({
      data: {
        conversationId: newGroup.id,
        senderId: currentUser.id,
        content: `Created group "${newGroup.name}"`,
        type: "TEXT",
      },
      include: {
        sender: {
          select: { id: true, displayName: true },
        },
      },
    });

    // Update conversation with the initial message
    newGroup.messages = [initialMsg as any];

    const formatted = formatConversation(newGroup, currentUser.id);

    // Broadcast new group to all members in real-time
    if ((global as any).io) {
      allMemberIds.forEach((mId) => {
        const memberFormatted = formatConversation(newGroup, mId);
        (global as any).io.to(`user:${mId}`).emit("conversation_created", memberFormatted);
      });
    }

    return NextResponse.json({ conversation: formatted }, { status: 201 });
  } catch (error: any) {
    console.error("Create conversation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create conversation" }, { status: 500 });
  }
}
