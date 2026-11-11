import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const calls = await prisma.callLog.findMany({
      where: {
        OR: [{ callerId: currentUser.id }, { receiverId: currentUser.id }],
      },
      include: {
        caller: {
          select: { id: true, displayName: true, avatar: true },
        },
        receiver: {
          select: { id: true, displayName: true, avatar: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ calls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch calls" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { callerId, receiverId, type, status, durationSec } = body;

    const callRecord = await prisma.callLog.create({
      data: {
        callerId: callerId || currentUser.id,
        receiverId,
        type: type || "AUDIO",
        status: status || "COMPLETED",
        durationSec: durationSec || 0,
        endedAt: new Date(),
      },
    });

    return NextResponse.json({ call: callRecord }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to record call" }, { status: 500 });
  }
}
