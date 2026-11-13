import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSelf = currentUser.id === id;
    const isAdmin = currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { displayName, avatar, designation, department, role, status, password, passcode } = body;

    // Security Gate: Changing Name or Password requires Passcode 9999
    const isChangingNameOrPassword = (displayName && displayName.trim() !== currentUser.displayName) || Boolean(password);
    if (isChangingNameOrPassword) {
      if (passcode !== "9999") {
        return NextResponse.json(
          { error: "Security Passcode Required: Please enter the 4-digit passcode (9999) to change your name or password." },
          { status: 403 }
        );
      }
    }

    const dataToUpdate: any = {};

    if (displayName) dataToUpdate.displayName = displayName.trim();
    if (avatar !== undefined) dataToUpdate.avatar = avatar;

    // Only admin can change role, status, designation or department for others
    if (isAdmin) {
      if (designation !== undefined) dataToUpdate.designation = designation;
      if (department !== undefined) dataToUpdate.department = department;
      if (role && (currentUser.role === "SUPER_ADMIN" || role !== "SUPER_ADMIN")) {
        dataToUpdate.role = role;
      }
      if (status) dataToUpdate.status = status;
    }

    if (password && (isSelf || isAdmin)) {
      dataToUpdate.passwordHash = await hashPassword(password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
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

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "EMPLOYEE_UPDATED",
        details: `Updated profile for ${updated.displayName} (${updated.username})`,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (currentUser.id === id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Soft delete / suspend by default for enterprise safety, or hard delete
    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "EMPLOYEE_DELETED",
        details: `Deleted employee ${targetUser.displayName} (${targetUser.username})`,
      },
    });

    return NextResponse.json({ success: true, message: "User deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}
