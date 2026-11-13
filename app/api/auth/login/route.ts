import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { ensureDatabaseReady } from "@/lib/bootstrap";

export async function POST(req: NextRequest) {
  try {
    // 1. Auto-bootstrap database if Neon tables or admin are missing
    await ensureDatabaseReady();

    const body = await req.json();
    const { identifier, phone, password, isDemoSwitch } = body;

    const rawInput = (phone || identifier || "").trim();

    if (!rawInput) {
      return NextResponse.json(
        { error: "Please enter your WhatsApp mobile phone number" },
        { status: 400 }
      );
    }

    const cleanInput = rawInput.toLowerCase();
    const digitsOnly = rawInput.replace(/\D/g, "");

    // 2. Look for registered employee by phone, username, or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: rawInput },
          { phone: `+${digitsOnly}` },
          { username: cleanInput },
          { email: cleanInput },
        ],
      },
    });

    // Flexible phone match if not found directly
    if (!user && digitsOnly.length >= 7) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, phone: true },
      });
      const match = allUsers.find((u) => {
        const uDigits = (u.phone || "").replace(/\D/g, "");
        return uDigits.endsWith(digitsOnly) || digitsOnly.endsWith(uDigits);
      });
      if (match) {
        user = await prisma.user.findUnique({ where: { id: match.id } });
      }
    }

    // 3. Number not found in registered company directory
    if (!user) {
      return NextResponse.json(
        {
          error:
            "This mobile number is not registered in ConnectPro. Only company-approved WhatsApp numbers can access the app. Please contact your company administrator to add your number.",
        },
        { status: 404 }
      );
    }

    // 4. Check account status
    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Your employee account has been suspended by company administration." },
        { status: 403 }
      );
    }

    // 5. Password verification (ONLY if password is explicitly provided e.g. for admin username login)
    // If logging in via phone number (WhatsApp style), password is NOT required!
    if (password && !isDemoSwitch) {
      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid password credentials" }, { status: 401 });
      }
    }

    // 6. Update user online status
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { isOnline: true, lastSeen: new Date() },
      });
    } catch (e) {
      // Non-fatal if update fails
    }

    // 7. Record login in audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "WHATSAPP_PHONE_LOGIN",
          details: `Employee ${user.displayName} authenticated via WhatsApp number ${user.phone}`,
          ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
        },
      });
    } catch (e) {
      // Non-fatal
    }

    // 8. Sign JWT Token
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
    console.error("Login route error:", error);
    return NextResponse.json(
      { error: error.message || "Authentication service temporarily unavailable" },
      { status: 500 }
    );
  }
}
