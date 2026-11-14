import { NextRequest, NextResponse } from "next/server";
import { verifyHubChallengeToken, verifyWebhookSignature } from "@/lib/whatsapp-crypto";
import { processWebhookPayload } from "@/lib/whatsapp-service";

/**
 * GET /api/whatsapp/webhook
 * Official Meta Cloud API Webhook Verification Challenge
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && verifyHubChallengeToken(token)) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json(
    { error: "Webhook verification failed: invalid verify_token or mode" },
    { status: 403 }
  );
}

/**
 * POST /api/whatsapp/webhook
 * Receives signed Meta WhatsApp Coexistence webhooks:
 * - messages
 * - smb_message_echoes
 * - smb_app_state_sync
 * - history
 * - account_update
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");

    if (!verifyWebhookSignature(rawBody, signatureHeader)) {
      return NextResponse.json(
        { error: "Invalid or missing X-Hub-Signature-256 signature" },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const result = await processWebhookPayload(payload);

    return NextResponse.json(
      {
        success: true,
        processedEvents: result.processedEvents,
        skippedDuplicates: result.skippedDuplicates,
        errors: result.errors,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("WhatsApp webhook handler error:", err.message);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }
}
