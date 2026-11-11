import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ departments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load departments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, description } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    const dept = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "DEPARTMENT_CREATED",
        details: `Created department "${dept.name}"`,
      },
    });

    return NextResponse.json({ department: dept }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create department" }, { status: 500 });
  }
}
