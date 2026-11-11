import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

    if (!conversation || !conversation.isGroup) {
      return NextResponse.json({ error: "Valid group not found" }, { status: 404 });
    }

    const myMembership = conversation.members.find((m) => m.userId === currentUser.id);
    const isAdmin = myMembership?.role === "ADMIN" || currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";

    if (!isAdmin) {
      return NextResponse.json({ error: "Only group admins can manage members" }, { status: 403 });
    }

    const { userIds, userId, action, role } = await req.json();

    // Add multiple members
    if (action === "ADD" && Array.isArray(userIds)) {
      for (const uId of userIds) {
        const exists = conversation.members.some((m) => m.userId === uId);
        if (!exists) {
          await prisma.conversationMember.create({
            data: {
              conversationId: id,
              userId: uId,
              role: "MEMBER",
            },
          });
        }
      }
      return NextResponse.json({ success: true, message: "Members added" });
    }

    // Remove single member
    if (action === "REMOVE" && userId) {
      await prisma.conversationMember.deleteMany({
        where: {
          conversationId: id,
          userId,
        },
      });
      return NextResponse.json({ success: true, message: "Member removed" });
    }

    // Toggle Role (ADMIN / MEMBER)
    if (action === "CHANGE_ROLE" && userId && role) {
      await prisma.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId: id,
            userId,
          },
        },
        data: { role },
      });
      return NextResponse.json({ success: true, message: "Role updated" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to manage members" }, { status: 500 });
  }
}
