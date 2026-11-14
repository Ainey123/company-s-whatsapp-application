import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendWhatsAppReply } from "@/lib/whatsapp-service";

/**
 * POST /api/whatsapp/send
 * Sends an outbound WhatsApp reply from an authenticated ConnectPro employee.
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      chatId,
      content,
      type = "TEXT",
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      mimeType,
      replyToWaMsgId,
      templateName,
      templateLanguage,
    } = body;

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }

    if (type === "TEXT" && (!content || !String(content).trim()) && !templateName) {
      return NextResponse.json(
        { error: "Message content cannot be empty" },
        { status: 400 }
      );
    }

    const sentMessage = await sendWhatsAppReply({
      chatId,
      senderUserId: currentUser.id,
      content: String(content || "").trim(),
      type,
      fileUrl,
      fileKey,
      fileName,
      fileSize,
      mimeType,
      replyToWaMsgId,
      templateName,
      templateLanguage,
    });

    return NextResponse.json({
      success: true,
      message: sentMessage,
    });
  } catch (err: any) {
    console.error("POST /api/whatsapp/send error:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to send WhatsApp message" },
      { status: 400 }
    );
  }
}
