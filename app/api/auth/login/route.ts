import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { ensureDatabaseReady, isProductionEnvironment } from "@/lib/bootstrap";

export async function POST(req: NextRequest) {
  try {
    // 1. Auto-bootstrap database if Neon tables or admin are missing
    await ensureDatabaseReady();

    const body = await req.json();
    const { identifier, phone, password } = body;

    const rawInput = (phone || identifier || "").trim();

    if (!rawInput) {
      return NextResponse.json(
        { error: "Please enter your username, email, or registered WhatsApp mobile number" },
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
          ...(digitsOnly ? [{ phone: `+${digitsOnly}` }] : []),
          { username: { equals: cleanInput, mode: "insensitive" } },
          { email: { equals: cleanInput, mode: "insensitive" } },
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

    // 3. Number/User not found in registered company directory
    if (!user) {
      return NextResponse.json(
        {
          error:
            "This mobile number or account is not registered in ConnectPro. Only company-approved users can access the app.",
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

    // 5. Password verification
    // Admin accounts (SUPER_ADMIN / ADMIN) and username/email logins ALWAYS require a valid password.
    const isAdminAccount =
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN" ||
      user.username.toLowerCase() === "admin";
    const isPhoneLookup =
      !isAdminAccount &&
      digitsOnly.length >= 7 &&
      (user.phone === rawInput ||
        user.phone === `+${digitsOnly}` ||
        (user.phone || "").replace(/\D/g, "").endsWith(digitsOnly));
    const requiresPassword = isAdminAccount || Boolean(password) || !isPhoneLookup;

    if (requiresPassword) {
      if (!password || typeof password !== "string" || !password.trim()) {
        return NextResponse.json(
          { error: "Password is required for this account" },
          { status: 401 }
        );
      }

      const isProd = isProductionEnvironment();

      // Hard block: the default 'admin123' password can NEVER work in production
      if (isProd && password === "admin123") {
        return NextResponse.json(
          { error: "Invalid password credentials" },
          { status: 401 }
        );
      }

      const isHashValid = user.passwordHash
        ? await comparePassword(password, user.passwordHash)
        : false;

      // Dev-only fallback: only when strictly not in production AND no custom ADMIN_INITIAL_PASSWORD is set
      const isDevOnlyOverride =
        !isProd &&
        !process.env.ADMIN_INITIAL_PASSWORD &&
        (cleanInput === "admin" || user.username.toLowerCase() === "admin") &&
        password === "admin123";

      if (!isHashValid && !isDevOnlyOverride) {
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
