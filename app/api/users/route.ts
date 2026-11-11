import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const department = searchParams.get("department");

    const where: any = {
      status: "ACTIVE",
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { displayName: { contains: q } },
        { username: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { department: { contains: q } },
        { designation: { contains: q } },
      ];
    }

    if (department && department !== "ALL") {
      where.department = department;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        displayName: true,
        avatar: true,
        designation: true,
        department: true,
        role: true,
        status: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
      },
      orderBy: [{ isOnline: "desc" }, { displayName: "asc" }],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { username, email, phone, password, displayName, designation, department, role, avatar } = body;

    if (!username || !email || !phone || !displayName) {
      return NextResponse.json({ error: "Name, username, email and mobile number are required" }, { status: 400 });
    }

    // Role assignment check: only super admin/admin can assign admin/super_admin roles
    let assignedRole = "EMPLOYEE";
    if (currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN") {
      assignedRole = role || "EMPLOYEE";
    }

    // Check unique constraints
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase().trim() },
          { email: email.toLowerCase().trim() },
          { phone: phone.trim() },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: "A contact with this username, email, or phone number already exists" }, { status: 409 });
    }

    const pwd = password && password.trim().length >= 6 ? password.trim() : "Password123!";
    const passwordHash = await hashPassword(pwd);

    const newUser = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        passwordHash,
        displayName: displayName.trim(),
        designation: designation?.trim() || "Staff Member",
        department: department?.trim() || "General",
        role: assignedRole,
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
        status: "ACTIVE",
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        displayName: true,
        avatar: true,
        designation: true,
        department: true,
        role: true,
        status: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
      },
    });

    // Auto-add new employee to General Company Announcements group if it exists
    const generalGroup = await prisma.conversation.findFirst({
      where: { isGroup: true, name: { contains: "General" } },
    });

    if (generalGroup) {
      await prisma.conversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: generalGroup.id,
            userId: newUser.id,
          },
        },
        update: {},
        create: {
          conversationId: generalGroup.id,
          userId: newUser.id,
          role: "MEMBER",
        },
      });
    }

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CONTACT_CREATED",
        details: `Created contact ${newUser.displayName} (@${newUser.username}, ${newUser.department})`,
      },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}
