import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { identifier, password, isDemoSwitch } = await req.json();

    if (!identifier) {
      return NextResponse.json({ error: "Username, email, or mobile number required" }, { status: 400 });
    }

    // Find by username, email, or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier.toLowerCase().trim() },
          { email: identifier.toLowerCase().trim() },
          { phone: identifier.trim() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Employee account not found" }, { status: 404 });
    }

    if (user.status === "SUSPENDED") {
      return NextResponse.json({ error: "Your account has been suspended by company administration." }, { status: 403 });
    }

    // If not demo quick-switch, verify password
    if (!isDemoSwitch) {
      if (!password) {
        return NextResponse.json({ error: "Password is required" }, { status: 400 });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid password credentials" }, { status: 401 });
      }
    }

    // Update user online status
    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    // Record login in audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        details: `Employee ${user.displayName} logged in via ${identifier}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const { passwordHash, ...safeUser } = user;

    const res = NextResponse.json({
      success: true,
      user: safeUser,
      token,
    });

    // Set secure HTTP-only cookie
    res.cookies.set("connectpro_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Authentication internal error" }, { status: 500 });
  }
}
