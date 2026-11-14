import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { encryptAccessToken, decryptAccessToken } from "@/lib/whatsapp-crypto";
import { META_GRAPH_BASE_URL, triggerCoexistenceSync, processWebhookPayload } from "@/lib/whatsapp-service";

function isAdminUser(user: any): boolean {
  return Boolean(user && user.status === "ACTIVE" && (user.role === "SUPER_ADMIN" || user.role === "ADMIN"));
}

/**
 * GET /api/whatsapp/onboarding
 * Returns current WhatsApp Coexistence connection status, sync progress,
 * 14-day physical phone heartbeat status, and webhook health diagnostics.
 * Never exposes raw access tokens or Meta secrets.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseReady();
    const currentUser = await getCurrentUser(req);
    if (!isAdminUser(currentUser)) {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    const account = await prisma.whatsAppAccount.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        connectedBy: {
          select: { id: true, username: true, displayName: true },
        },
        _count: {
          select: { chats: true },
        },
      },
    });

    const totalMessages = await prisma.whatsAppMessage.count();
    const totalEchoes = await prisma.whatsAppMessage.count({
      where: { source: "PHYSICAL_PHONE" },
    });
    const totalHistorySynced = await prisma.whatsAppMessage.count({
      where: { source: "HISTORY_SYNC" },
    });
    const recentWebhooks = await prisma.whatsAppWebhookEvent.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        idempotencyKey: true,
        eventType: true,
        status: true,
        retryCount: true,
        waMessageId: true,
        createdAt: true,
      },
    });

    // Calculate 14-day physical phone inactivity warning
    let phoneHeartbeatDaysRemaining: number | null = null;
    if (account) {
      const refDate = account.lastEchoAt || account.createdAt;
      const elapsedDays = (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24);
      phoneHeartbeatDaysRemaining = Math.max(0, Math.round((14 - elapsedDays) * 10) / 10);
    }

    // Safe account projection (accessTokenEncrypted strictly omitted)
    const safeAccount = account
      ? {
          id: account.id,
          wabaId: account.wabaId,
          phoneNumberId: account.phoneNumberId,
          displayPhoneNumber: account.displayPhoneNumber,
          verifiedName: account.verifiedName,
          coexistenceEnabled: account.coexistenceEnabled,
          status: account.status,
          appVersionConfirmed: account.appVersionConfirmed,
          historySyncStatus: account.historySyncStatus,
          historySyncProgress: account.historySyncProgress,
          historyTriggeredAt: account.historyTriggeredAt,
          contactSyncStatus: account.contactSyncStatus,
          lastWebhookAt: account.lastWebhookAt,
          lastEchoAt: account.lastEchoAt,
          connectedBy: account.connectedBy,
          chatsCount: account._count.chats,
          phoneHeartbeatDaysRemaining,
          isTestAccount: account.phoneNumberId.startsWith("test_"),
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        }
      : null;

    return NextResponse.json({
      account: safeAccount,
      diagnostics: {
        totalMessages,
        totalEchoes,
        totalHistorySynced,
        recentWebhooks,
        envConfigured: {
          metaAppId: Boolean(process.env.NEXT_PUBLIC_META_APP_ID),
          metaConfigId: Boolean(process.env.NEXT_PUBLIC_META_CONFIG_ID),
          metaAppSecret: Boolean(process.env.META_APP_SECRET),
          webhookVerifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
          tokenEncryptionKey: Boolean(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY),
        },
      },
    });
  } catch (err: any) {
    console.error("GET /api/whatsapp/onboarding error:", err.message);
    return NextResponse.json(
      { error: "Failed to load WhatsApp onboarding status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whatsapp/onboarding
 * Actions:
 * 1. exchange_code: Exchanges Embedded Signup v4 OAuth code, encrypts token, subscribes webhooks, and triggers Coexistence sync.
 * 2. connect_test_account: Provisions a safe sandbox test account for pre-production verification.
 * 3. trigger_sync: Triggers smb_app_state_sync & history sync within the 24h window.
 * 4. disconnect: Safely disconnects the WhatsAppAccount in ConnectPro.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseReady();
    const currentUser = await getCurrentUser(req);
    if (!isAdminUser(currentUser)) {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "connect_direct_token") {
      const wabaId = String(body.wabaId || "").trim();
      const phoneNumberId = String(body.phoneNumberId || "").trim();
      const accessToken = String(body.accessToken || "").trim();
      const displayPhoneNumber = String(body.displayPhoneNumber || "").trim();
      const verifiedName = String(body.verifiedName || "").trim();

      if (!wabaId || !phoneNumberId || !accessToken) {
        return NextResponse.json(
          { error: "WABA ID, Phone Number ID, and Meta Access Token are required." },
          { status: 400 }
        );
      }

      // 1. Verify credentials with Meta Graph API
      let resolvedPhone = displayPhoneNumber || phoneNumberId;
      let resolvedName = verifiedName || "Company WhatsApp Business";
      let appVersionConfirmed: string | null = "Meta Cloud / Coexistence v23.0";

      const phoneRes = await fetch(
        `${META_GRAPH_BASE_URL}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const phoneJson = await phoneRes.json();
      if (!phoneRes.ok) {
        return NextResponse.json(
          {
            error:
              phoneJson?.error?.message ||
              "Meta Graph API rejected the Phone Number ID or Access Token. Please check your credentials.",
          },
          { status: 400 }
        );
      }

      resolvedPhone = phoneJson.display_phone_number || resolvedPhone;
      resolvedName = phoneJson.verified_name || resolvedName;
      if (phoneJson.platform_type) {
        appVersionConfirmed = `Platform: ${phoneJson.platform_type}${phoneJson.is_on_biz_app ? " (Coexistence Active)" : ""}`;
      }

      // 2. Subscribe WABA to webhook events
      try {
        await fetch(
          `${META_GRAPH_BASE_URL}/${encodeURIComponent(wabaId)}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (e: any) {
        console.warn("WABA subscribed_apps warning:", e.message);
      }

      // 3. Encrypt token & persist WhatsAppAccount
      const encryptedToken = encryptAccessToken(accessToken);
      const account = await prisma.whatsAppAccount.upsert({
        where: { phoneNumberId },
        create: {
          wabaId,
          phoneNumberId,
          displayPhoneNumber: resolvedPhone,
          verifiedName: resolvedName,
          accessTokenEncrypted: encryptedToken,
          coexistenceEnabled: true,
          status: "CONNECTED",
          appVersionConfirmed,
          connectedByUserId: currentUser!.id,
        },
        update: {
          wabaId,
          displayPhoneNumber: resolvedPhone,
          verifiedName: resolvedName,
          accessTokenEncrypted: encryptedToken,
          coexistenceEnabled: true,
          status: "CONNECTED",
          appVersionConfirmed,
          connectedByUserId: currentUser!.id,
        },
      });

      // 4. Trigger Coexistence contact & 180-day history sync
      const syncResult = await triggerCoexistenceSync({
        accountId: account.id,
        phoneNumberId: account.phoneNumberId,
        accessToken,
      });

      await prisma.auditLog.create({
        data: {
          userId: currentUser!.id,
          action: "WHATSAPP_DIRECT_CONNECTED",
          details: `Connected real WhatsApp Business number ${resolvedPhone} (WABA: ${wabaId})`,
        },
      });

      return NextResponse.json({
        success: true,
        accountId: account.id,
        displayPhoneNumber: resolvedPhone,
        verifiedName: resolvedName,
        sync: syncResult,
      });
    }

    if (action === "connect_test_account") {
      const wabaId = body.wabaId || "test_waba_sandbox_001";
      const phoneNumberId = body.phoneNumberId || "test_phone_sandbox_001";
      const displayPhoneNumber = body.displayPhoneNumber || "+92 300 0000000 (Sandbox Test)";
      const verifiedName = body.verifiedName || "ConnectPro Sandbox Test Account";
      const encryptedToken = encryptAccessToken("test_sandbox_access_token_do_not_use_in_prod");

      const account = await prisma.whatsAppAccount.upsert({
        where: { phoneNumberId },
        create: {
          wabaId,
          phoneNumberId,
          displayPhoneNumber,
          verifiedName,
          accessTokenEncrypted: encryptedToken,
          coexistenceEnabled: true,
          status: "CONNECTED",
          appVersionConfirmed: "2.25.10.72 (Sandbox)",
          historySyncStatus: "PENDING",
          contactSyncStatus: "PENDING",
          connectedByUserId: currentUser!.id,
        },
        update: {
          status: "CONNECTED",
          accessTokenEncrypted: encryptedToken,
          connectedByUserId: currentUser!.id,
        },
      });

      const syncRes = await triggerCoexistenceSync({
        accountId: account.id,
        phoneNumberId: account.phoneNumberId,
        accessToken: "test_sandbox_access_token_do_not_use_in_prod",
      });

      await prisma.auditLog.create({
        data: {
          userId: currentUser!.id,
          action: "WHATSAPP_SANDBOX_CONNECTED",
          details: `Connected WhatsApp Coexistence Sandbox Test Account (${displayPhoneNumber})`,
        },
      });

      // Automatically seed initial sandbox customer chats via the real webhook pipeline if none exist yet
      const existingChatCount = await prisma.whatsAppChat.count({
        where: { accountId: account.id },
      });

      if (existingChatCount === 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        await processWebhookPayload({
          object: "whatsapp_business_account",
          entry: [
            {
              id: wabaId,
              changes: [
                {
                  field: "messages",
                  value: {
                    messaging_product: "whatsapp",
                    metadata: {
                      display_phone_number: "923000000000",
                      phone_number_id: phoneNumberId,
                    },
                    contacts: [
                      { profile: { name: "Tariq Mahmood (Indus Engineering)" }, wa_id: "923214567890" },
                      { profile: { name: "Ayesha Siddiqui (Apex Logistics)" }, wa_id: "923009876543" },
                    ],
                    messages: [
                      {
                        from: "923214567890",
                        id: "wamid.sandbox_init_001",
                        timestamp: String(nowSec - 600),
                        type: "text",
                        text: { body: "Assalam-o-Alaikum, can you confirm the delivery schedule for order #PK-8842?" },
                      },
                      {
                        from: "923009876543",
                        id: "wamid.sandbox_init_002",
                        timestamp: String(nowSec - 300),
                        type: "text",
                        text: { body: "Hello! We have uploaded our updated NTN certificate for corporate billing." },
                      },
                    ],
                  },
                },
                {
                  field: "smb_message_echoes",
                  value: {
                    messaging_product: "whatsapp",
                    metadata: {
                      display_phone_number: "923000000000",
                      phone_number_id: phoneNumberId,
                    },
                    message_echoes: [
                      {
                        from: "923000000000",
                        to: "923009876543",
                        id: "wamid.sandbox_echo_001",
                        timestamp: String(nowSec - 120),
                        type: "text",
                        text: { body: "Received on our office WhatsApp phone — forwarding to our billing team in ConnectPro." },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });
      }

      return NextResponse.json({
        success: true,
        accountId: account.id,
        sync: syncRes,
      });
    }

    if (action === "exchange_code") {
      const { code, wabaId, phoneNumberId, displayPhoneNumber, verifiedName } = body;
      if (!code || !wabaId || !phoneNumberId) {
        return NextResponse.json(
          { error: "Missing required Embedded Signup parameters (code, wabaId, phoneNumberId)" },
          { status: 400 }
        );
      }

      const appId = String(process.env.NEXT_PUBLIC_META_APP_ID || body.appId || "").trim();
      const appSecret = String(process.env.META_APP_SECRET || body.appSecret || "").trim();
      if (!appId || !appSecret) {
        return NextResponse.json(
          { error: "Missing Meta App ID or Meta App Secret (provide in form or set NEXT_PUBLIC_META_APP_ID / META_APP_SECRET)" },
          { status: 400 }
        );
      }

      // 1. Exchange authorization code for WABA access token
      const tokenUrl = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("code", code);

      const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        return NextResponse.json(
          {
            error:
              tokenData?.error?.message ||
              "Failed to exchange Embedded Signup authorization code with Meta",
          },
          { status: 400 }
        );
      }

      const accessToken = String(tokenData.access_token);
      const encryptedToken = encryptAccessToken(accessToken);

      // 2. Fetch phone number metadata from Meta if not provided
      let resolvedPhone = displayPhoneNumber || phoneNumberId;
      let resolvedName = verifiedName || "Company WhatsApp Business";
      try {
        const phoneRes = await fetch(
          `${META_GRAPH_BASE_URL}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (phoneRes.ok) {
          const phoneJson = await phoneRes.json();
          resolvedPhone = phoneJson.display_phone_number || resolvedPhone;
          resolvedName = phoneJson.verified_name || resolvedName;
        }
      } catch {
        // Non-fatal metadata lookup
      }

      // 3. Subscribe WABA to webhook fields on our app
      try {
        await fetch(
          `${META_GRAPH_BASE_URL}/${encodeURIComponent(wabaId)}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (e: any) {
        console.warn("WABA subscribed_apps warning:", e.message);
      }

      // 4. Store encrypted account record
      const account = await prisma.whatsAppAccount.upsert({
        where: { phoneNumberId: String(phoneNumberId) },
        create: {
          wabaId: String(wabaId),
          phoneNumberId: String(phoneNumberId),
          displayPhoneNumber: resolvedPhone,
          verifiedName: resolvedName,
          accessTokenEncrypted: encryptedToken,
          coexistenceEnabled: true,
          status: "CONNECTED",
          connectedByUserId: currentUser!.id,
        },
        update: {
          wabaId: String(wabaId),
          displayPhoneNumber: resolvedPhone,
          verifiedName: resolvedName,
          accessTokenEncrypted: encryptedToken,
          coexistenceEnabled: true,
          status: "CONNECTED",
          connectedByUserId: currentUser!.id,
        },
      });

      // 5. Immediately trigger one-time Coexistence contact & 180-day history sync within 24h window
      const syncResult = await triggerCoexistenceSync({
        accountId: account.id,
        phoneNumberId: account.phoneNumberId,
        accessToken,
      });

      await prisma.auditLog.create({
        data: {
          userId: currentUser!.id,
          action: "WHATSAPP_COEXISTENCE_ONBOARDED",
          details: `Onboarded WhatsApp Business Coexistence number ${resolvedPhone} (WABA: ${wabaId})`,
        },
      });

      return NextResponse.json({
        success: true,
        accountId: account.id,
        displayPhoneNumber: resolvedPhone,
        verifiedName: resolvedName,
        sync: syncResult,
      });
    }

    if (action === "trigger_sync") {
      const account = await prisma.whatsAppAccount.findFirst({
        orderBy: { createdAt: "desc" },
      });
      if (!account) {
        return NextResponse.json({ error: "No connected WhatsApp account found" }, { status: 404 });
      }

      const accessToken = decryptAccessToken(account.accessTokenEncrypted);
      const syncResult = await triggerCoexistenceSync({
        accountId: account.id,
        phoneNumberId: account.phoneNumberId,
        accessToken,
      });

      return NextResponse.json({
        success: true,
        sync: syncResult,
      });
    }

    if (action === "disconnect") {
      const account = await prisma.whatsAppAccount.findFirst({
        orderBy: { createdAt: "desc" },
      });
      if (!account) {
        return NextResponse.json({ error: "No WhatsApp account found" }, { status: 404 });
      }

      await prisma.whatsAppAccount.update({
        where: { id: account.id },
        data: { status: "DISCONNECTED" },
      });

      await prisma.auditLog.create({
        data: {
          userId: currentUser!.id,
          action: "WHATSAPP_ACCOUNT_DISCONNECTED",
          details: `Admin disconnected WhatsApp account ${account.displayPhoneNumber} in ConnectPro`,
        },
      });

      return NextResponse.json({ success: true, status: "DISCONNECTED" });
    }

    return NextResponse.json({ error: "Unsupported onboarding action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/whatsapp/onboarding error:", err.message);
    return NextResponse.json(
      { error: err.message || "Onboarding operation failed" },
      { status: 500 }
    );
  }
}
