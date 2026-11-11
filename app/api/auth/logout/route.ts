import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isOnline: false, lastSeen: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "USER_LOGOUT",
          details: `Employee ${user.displayName} logged out`,
        },
      });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.delete("connectpro_token");
    return res;
  } catch (error) {
    const res = NextResponse.json({ success: true });
    res.cookies.delete("connectpro_token");
    return res;
  }
}
