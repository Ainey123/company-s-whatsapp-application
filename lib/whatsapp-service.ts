import crypto from "crypto";
import prisma from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { decryptAccessToken } from "@/lib/whatsapp-crypto";

export const META_GRAPH_VERSION = "v23.0";
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export function normalizeWaId(rawPhone: string): string {
  return (rawPhone || "").replace(/\D/g, "");
}

export function formatDisplayPhone(waIdOrPhone: string): string {
  const digits = normalizeWaId(waIdOrPhone);
  if (!digits) return waIdOrPhone;
  if (digits.startsWith("92") && digits.length === 12) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return `+${digits}`;
}

export function isWithin24HourServiceWindow(lastCustomerMsgAt: Date | string | null | undefined): {
  isOpen: boolean;
  expiresAt: string | null;
  remainingMinutes: number;
} {
  if (!lastCustomerMsgAt) {
    return { isOpen: false, expiresAt: null, remainingMinutes: 0 };
  }
  const lastMs = new Date(lastCustomerMsgAt).getTime();
  if (Number.isNaN(lastMs)) {
    return { isOpen: false, expiresAt: null, remainingMinutes: 0 };
  }
  const expiresMs = lastMs + 24 * 60 * 60 * 1000;
  const diffMs = expiresMs - Date.now();
  if (diffMs <= 0) {
    return { isOpen: false, expiresAt: new Date(expiresMs).toISOString(), remainingMinutes: 0 };
  }
  return {
    isOpen: true,
    expiresAt: new Date(expiresMs).toISOString(),
    remainingMinutes: Math.ceil(diffMs / 60000),
  };
}

export function getStatusRank(status: string): number {
  switch ((status || "").toUpperCase()) {
    case "PENDING":
      return 0;
    case "SENT":
      return 1;
    case "DELIVERED":
      return 2;
    case "READ":
      return 3;
    case "FAILED":
      return -1;
    default:
      return 1;
  }
}

export function mapMetaMessageType(rawType: string): string {
  const t = (rawType || "text").toLowerCase();
  switch (t) {
    case "text":
    case "button":
    case "interactive":
      return "TEXT";
    case "image":
      return "IMAGE";
    case "video":
      return "VIDEO";
    case "audio":
      return "AUDIO";
    case "voice":
      return "VOICE";
    case "document":
      return "DOCUMENT";
    case "sticker":
      return "STICKER";
    case "location":
      return "LOCATION";
    case "reaction":
      return "REACTION";
    default:
      return "TEXT";
  }
}

/**
 * Downloads media from Meta Cloud API using the encrypted WABA access token
 * and persists it into ConnectPro storage (Cloudflare R2 or local /public/uploads).
 */
export async function downloadAndPersistWhatsAppMedia(params: {
  mediaId: string;
  accessToken: string;
  type: string;
  fileName?: string;
  mimeType?: string;
  mockContentBase64?: string;
}): Promise<{
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string | null;
} | null> {
  const { mediaId, accessToken, type, fileName, mimeType, mockContentBase64 } = params;

  try {
    // Support sandbox/test media injection without hitting external network when mockContentBase64 is provided
    if (mockContentBase64 || mediaId.startsWith("test_media_")) {
      const buffer = mockContentBase64
        ? Buffer.from(mockContentBase64, "base64")
        : Buffer.from(`Simulated media content for ${mediaId}`, "utf8");
      const defaultExt =
        type === "IMAGE"
          ? ".png"
          : type === "DOCUMENT"
            ? ".pdf"
            : type === "VOICE" || type === "AUDIO"
              ? ".ogg"
              : ".bin";
      const safeName = fileName || `${mediaId}${defaultExt}`;
      const safeMime =
        mimeType ||
        (type === "IMAGE"
          ? "image/png"
          : type === "DOCUMENT"
            ? "application/pdf"
            : type === "VOICE" || type === "AUDIO"
              ? "audio/ogg"
              : "application/octet-stream");

      return await uploadFile(buffer, safeName, safeMime, type);
    }

    // 1. Fetch temporary media metadata/URL from Meta Graph API
    const metaRes = await fetch(`${META_GRAPH_BASE_URL}/${encodeURIComponent(mediaId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!metaRes.ok) {
      throw new Error(`Meta media metadata lookup failed with HTTP ${metaRes.status}`);
    }

    const metaJson = await metaRes.json();
    const downloadUrl = metaJson.url;
    const resolvedMime = metaJson.mime_type || mimeType || "application/octet-stream";

    if (!downloadUrl) {
      throw new Error("Meta media response did not contain a download URL");
    }

    // Security check: only send Authorization Bearer token to official Meta/WhatsApp HTTPS CDN hosts
    const parsedUrl = new URL(downloadUrl);
    const allowedHostSuffixes = [".fbsbx.com", ".fbcdn.net", ".whatsapp.net", ".facebook.com"];
    const isAllowedHost =
      parsedUrl.protocol === "https:" &&
      allowedHostSuffixes.some(
        (suffix) => parsedUrl.hostname.endsWith(suffix) || parsedUrl.hostname === suffix.slice(1)
      );
    if (!isAllowedHost) {
      throw new Error(`Refusing to send WABA token to untrusted media host: ${parsedUrl.hostname}`);
    }

    // 2. Download binary media stream from Meta
    const binRes = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!binRes.ok) {
      throw new Error(`Meta media binary download failed with HTTP ${binRes.status}`);
    }

    const arrayBuf = await binRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const extFromMime = resolvedMime.split("/")[1]?.split(";")[0] || "bin";
    const resolvedName = fileName || `wa-${mediaId}.${extFromMime}`;

    // 3. Persist permanently in ConnectPro's R2 / local storage
    return await uploadFile(buffer, resolvedName, resolvedMime, type);
  } catch (err: any) {
    console.error(`Failed to download/persist WhatsApp media (${mediaId}):`, err.message);
    return null;
  }
}

/**
 * Triggers the one-time Coexistence contact book sync (smb_app_state_sync) and
 * 180-day chat history sync (history) within Meta's 24-hour post-onboarding window.
 */
export async function triggerCoexistenceSync(params: {
  accountId: string;
  phoneNumberId: string;
  accessToken: string;
}): Promise<{ contactSyncTriggered: boolean; historySyncTriggered: boolean; errors: string[] }> {
  const { accountId, phoneNumberId, accessToken } = params;
  const errors: string[] = [];
  let contactSyncTriggered = false;
  let historySyncTriggered = false;

  // Test/sandbox account bypasses external HTTP call
  if (phoneNumberId.startsWith("test_")) {
    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        contactSyncStatus: "IN_PROGRESS",
        historySyncStatus: "IN_PROGRESS",
        historyTriggeredAt: new Date(),
      },
    });
    return { contactSyncTriggered: true, historySyncTriggered: true, errors: [] };
  }

  // 1. Trigger contact book state sync
  try {
    const contactRes = await fetch(
      `${META_GRAPH_BASE_URL}/${encodeURIComponent(phoneNumberId)}/smb_app_data`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          sync_type: "smb_app_state_sync",
        }),
      }
    );
    if (contactRes.ok) {
      contactSyncTriggered = true;
    } else {
      const errBody = await contactRes.text();
      errors.push(`smb_app_state_sync HTTP ${contactRes.status}: ${errBody}`);
    }
  } catch (e: any) {
    errors.push(`smb_app_state_sync error: ${e.message}`);
  }

  // 2. Trigger 180-day 1:1 message history sync
  try {
    const historyRes = await fetch(
      `${META_GRAPH_BASE_URL}/${encodeURIComponent(phoneNumberId)}/smb_app_data`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          sync_type: "history",
        }),
      }
    );
    if (historyRes.ok) {
      historySyncTriggered = true;
    } else {
      const errBody = await historyRes.text();
      errors.push(`history HTTP ${historyRes.status}: ${errBody}`);
    }
  } catch (e: any) {
    errors.push(`history error: ${e.message}`);
  }

  await prisma.whatsAppAccount.update({
    where: { id: accountId },
    data: {
      contactSyncStatus: contactSyncTriggered ? "IN_PROGRESS" : "PENDING",
      historySyncStatus: historySyncTriggered ? "IN_PROGRESS" : "PENDING",
      historyTriggeredAt: historySyncTriggered ? new Date() : undefined,
    },
  });

  return { contactSyncTriggered, historySyncTriggered, errors };
}

/**
 * Extracts text content and media metadata from a raw Meta message object.
 */
function extractMessageDetails(msg: any): {
  type: string;
  content: string;
  mediaId?: string;
  fileName?: string;
  mimeType?: string;
  mockContentBase64?: string;
  replyToWaMsgId?: string;
  reactionEmoji?: string;
  isEdited?: boolean;
  isRevoked?: boolean;
  targetWaMsgId?: string;
} {
  const rawType = (msg.type || "text").toLowerCase();
  const replyToWaMsgId = msg.context?.id || undefined;

  if (rawType === "revoke" || msg.revoke) {
    return {
      type: "SYSTEM",
      content: "This message was deleted on WhatsApp",
      isRevoked: true,
      targetWaMsgId: msg.revoke?.original_message_id || msg.protocol?.original_message_id || msg.id,
    };
  }

  if (rawType === "edit" || msg.edit) {
    const editedBody =
      msg.edit?.text?.body || msg.text?.body || "[Edited message]";
    return {
      type: "TEXT",
      content: editedBody,
      isEdited: true,
      targetWaMsgId: msg.edit?.original_message_id || msg.id,
    };
  }

  if (rawType === "reaction" && msg.reaction) {
    return {
      type: "REACTION",
      content: msg.reaction.emoji || "",
      reactionEmoji: msg.reaction.emoji || "",
      replyToWaMsgId: msg.reaction.message_id,
    };
  }

  if (rawType === "text") {
    return {
      type: "TEXT",
      content: msg.text?.body || "",
      replyToWaMsgId,
    };
  }

  if (rawType === "button") {
    return {
      type: "TEXT",
      content: msg.button?.text || msg.button?.payload || "[Button Reply]",
      replyToWaMsgId,
    };
  }

  if (rawType === "interactive") {
    const inter = msg.interactive;
    const text =
      inter?.button_reply?.title ||
      inter?.list_reply?.title ||
      "[Interactive Reply]";
    return {
      type: "TEXT",
      content: text,
      replyToWaMsgId,
    };
  }

  if (["image", "video", "audio", "voice", "document", "sticker"].includes(rawType)) {
    const mediaObj = msg[rawType] || {};
    const mappedType =
      rawType === "audio" && mediaObj.voice ? "VOICE" : mapMetaMessageType(rawType);
    const caption =
      mediaObj.caption ||
      (mappedType === "VOICE"
        ? "Voice message"
        : mappedType === "DOCUMENT"
          ? mediaObj.filename || "Document attachment"
          : `${mappedType} attachment`);
    return {
      type: mappedType,
      content: caption,
      mediaId: mediaObj.id,
      fileName: mediaObj.filename,
      mimeType: mediaObj.mime_type,
      mockContentBase64: mediaObj.mock_base64,
      replyToWaMsgId,
    };
  }

  if (rawType === "location" && msg.location) {
    const loc = msg.location;
    const label = loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`;
    return {
      type: "LOCATION",
      content: `📍 Location: ${label} (${loc.latitude}, ${loc.longitude})`,
      replyToWaMsgId,
    };
  }

  if (rawType === "contacts" && Array.isArray(msg.contacts)) {
    const names = msg.contacts
      .map((c: any) => c.name?.formatted_name || "Contact")
      .join(", ");
    return {
      type: "TEXT",
      content: `👤 Shared Contact: ${names}`,
      replyToWaMsgId,
    };
  }

  return {
    type: "TEXT",
    content: msg.text?.body || `[${rawType} message]`,
    replyToWaMsgId,
  };
}

/**
 * Records or checks an atomic webhook idempotency event.
 * Returns { alreadyProcessed: true } if this exact event was already processed.
 */
async function claimWebhookIdempotency(params: {
  idempotencyKey: string;
  eventType: string;
  wabaId?: string;
  phoneNumberId?: string;
  waMessageId?: string;
  payloadObj: any;
}): Promise<{ alreadyProcessed: boolean; eventRecordId: string }> {
  const { idempotencyKey, eventType, wabaId, phoneNumberId, waMessageId, payloadObj } = params;

  const existing = await prisma.whatsAppWebhookEvent.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status === "PROCESSED") {
    await prisma.whatsAppWebhookEvent.update({
      where: { id: existing.id },
      data: { retryCount: { increment: 1 } },
    });
    return { alreadyProcessed: true, eventRecordId: existing.id };
  }

  if (existing) {
    const updated = await prisma.whatsAppWebhookEvent.update({
      where: { id: existing.id },
      data: {
        status: "PROCESSING",
        retryCount: { increment: 1 },
        errorDetails: null,
      },
    });
    return { alreadyProcessed: false, eventRecordId: updated.id };
  }

  try {
    const created = await prisma.whatsAppWebhookEvent.create({
      data: {
        idempotencyKey,
        eventType,
        wabaId: wabaId || null,
        phoneNumberId: phoneNumberId || null,
        waMessageId: waMessageId || null,
        status: "PROCESSING",
        payloadJson: JSON.stringify(payloadObj),
      },
    });

    return { alreadyProcessed: false, eventRecordId: created.id };
  } catch (err: any) {
    // Handle concurrent duplicate webhook race condition (P2002 unique constraint)
    if (err?.code === "P2002") {
      const concurrent = await prisma.whatsAppWebhookEvent.findUnique({
        where: { idempotencyKey },
      });
      if (concurrent) {
        return { alreadyProcessed: true, eventRecordId: concurrent.id };
      }
    }
    throw err;
  }
}

/**
 * Resolves or creates the WhatsAppAccount for incoming webhook events.
 */
async function resolveWhatsAppAccount(wabaId: string, phoneNumberId?: string, displayPhone?: string) {
  if (phoneNumberId) {
    const byPhone = await prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId },
    });
    if (byPhone) return byPhone;
  }

  if (wabaId) {
    const byWaba = await prisma.whatsAppAccount.findUnique({
      where: { wabaId },
    });
    if (byWaba) return byWaba;
  }

  // Fallback to first connected account if only one exists
  const first = await prisma.whatsAppAccount.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return first;
}

/**
 * Processes a full Meta WhatsApp webhook payload across all 5 Coexistence fields:
 * - messages (inbound customer messages + outbound status updates)
 * - smb_message_echoes (outbound manual messages sent from the physical WhatsApp Business phone)
 * - history (180-day 1:1 message & 14-day media backfill chunks)
 * - smb_app_state_sync (contact book sync from the physical phone)
 * - account_update (coexistence lifecycle status updates)
 */
export async function processWebhookPayload(payload: any): Promise<{
  processedEvents: number;
  skippedDuplicates: number;
  errors: string[];
}> {
  let processedEvents = 0;
  let skippedDuplicates = 0;
  const errors: string[] = [];

  if (!payload || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return { processedEvents, skippedDuplicates, errors: ["Invalid webhook object type"] };
  }

  for (const entry of payload.entry) {
    const wabaId = String(entry.id || "");
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      const field = String(change.field || "");
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id
        ? String(value.metadata.phone_number_id)
        : undefined;
      const displayPhone = value.metadata?.display_phone_number
        ? String(value.metadata.display_phone_number)
        : undefined;

      const account = await resolveWhatsAppAccount(wabaId, phoneNumberId, displayPhone);
      if (!account) {
        errors.push(`No matching WhatsAppAccount found for wabaId=${wabaId} phoneNumberId=${phoneNumberId || "none"}`);
        continue;
      }

      let accessToken = "";
      try {
        accessToken = decryptAccessToken(account.accessTokenEncrypted);
      } catch {
        accessToken = "";
      }

      // Update lastWebhookAt on account
      await prisma.whatsAppAccount.update({
        where: { id: account.id },
        data: { lastWebhookAt: new Date() },
      });

      // ----------------------------------------------------------------------
      // FIELD 1: messages (Inbound Customer Messages & Outbound Statuses)
      // ----------------------------------------------------------------------
      if (field === "messages") {
        const contactsMap = new Map<string, string>();
        if (Array.isArray(value.contacts)) {
          for (const c of value.contacts) {
            const cWaId = normalizeWaId(c.wa_id || "");
            const cName = c.profile?.name || "";
            if (cWaId && cName) {
              contactsMap.set(cWaId, cName);
            }
          }
        }

        // 1A. Inbound customer messages
        if (Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const wamid = String(msg.id || "");
            if (!wamid) continue;

            const idempotencyKey = `msg:${wamid}`;
            const claim = await claimWebhookIdempotency({
              idempotencyKey,
              eventType: "messages",
              wabaId,
              phoneNumberId: account.phoneNumberId,
              waMessageId: wamid,
              payloadObj: msg,
            });

            if (claim.alreadyProcessed) {
              skippedDuplicates++;
              continue;
            }

            try {
              const customerWaId = normalizeWaId(msg.from || "");
              const customerName = contactsMap.get(customerWaId) || undefined;
              const waTimestamp = msg.timestamp
                ? new Date(Number(msg.timestamp) * 1000)
                : new Date();
              const details = extractMessageDetails(msg);

              // Handle edit or revoke of an existing message
              if ((details.isEdited || details.isRevoked) && details.targetWaMsgId) {
                const existingTarget = await prisma.whatsAppMessage.findUnique({
                  where: { waMessageId: details.targetWaMsgId },
                });
                if (existingTarget) {
                  await prisma.whatsAppMessage.update({
                    where: { id: existingTarget.id },
                    data: {
                      content: details.content,
                      isEdited: Boolean(details.isEdited),
                      isRevoked: Boolean(details.isRevoked),
                    },
                  });
                }
                await prisma.whatsAppWebhookEvent.update({
                  where: { id: claim.eventRecordId },
                  data: { status: "PROCESSED" },
                });
                processedEvents++;
                continue;
              }

              // Upsert customer chat
              let chat = await prisma.whatsAppChat.findUnique({
                where: {
                  accountId_customerWaId: {
                    accountId: account.id,
                    customerWaId,
                  },
                },
              });

              const existingMsg = await prisma.whatsAppMessage.findUnique({
                where: { waMessageId: wamid },
              });

              if (!chat) {
                chat = await prisma.whatsAppChat.create({
                  data: {
                    accountId: account.id,
                    customerWaId,
                    customerPhone: formatDisplayPhone(customerWaId),
                    customerName: customerName || formatDisplayPhone(customerWaId),
                    status: "OPEN",
                    unreadCount: existingMsg ? 0 : 1,
                    lastCustomerMsgAt: waTimestamp,
                    lastMessageAt: waTimestamp,
                    lastMessagePreview: details.content.slice(0, 160),
                    lastMessageSource: "CUSTOMER",
                  },
                });
              } else if (!existingMsg) {
                chat = await prisma.whatsAppChat.update({
                  where: { id: chat.id },
                  data: {
                    customerName: customerName || chat.customerName,
                    status: chat.status === "RESOLVED" ? "OPEN" : chat.status,
                    unreadCount: { increment: 1 },
                    lastCustomerMsgAt:
                      !chat.lastCustomerMsgAt || waTimestamp > chat.lastCustomerMsgAt
                        ? waTimestamp
                        : chat.lastCustomerMsgAt,
                    lastMessageAt:
                      waTimestamp > chat.lastMessageAt ? waTimestamp : chat.lastMessageAt,
                    lastMessagePreview: details.content.slice(0, 160),
                    lastMessageSource: "CUSTOMER",
                  },
                });
              }

              // Download and persist media if present
              let mediaResult = null;
              if (details.mediaId && accessToken) {
                mediaResult = await downloadAndPersistWhatsAppMedia({
                  mediaId: details.mediaId,
                  accessToken,
                  type: details.type,
                  fileName: details.fileName,
                  mimeType: details.mimeType,
                  mockContentBase64: details.mockContentBase64,
                });
              }

              await prisma.whatsAppMessage.upsert({
                where: { waMessageId: wamid },
                create: {
                  chatId: chat.id,
                  waMessageId: wamid,
                  direction: "INBOUND",
                  source: "CUSTOMER",
                  type: details.type,
                  content: details.content,
                  mediaId: details.mediaId || null,
                  fileUrl: mediaResult?.fileUrl || null,
                  fileKey: mediaResult?.fileKey || null,
                  fileName: mediaResult?.fileName || details.fileName || null,
                  fileSize: mediaResult?.fileSize || null,
                  mimeType: mediaResult?.mimeType || details.mimeType || null,
                  thumbnailUrl: mediaResult?.thumbnailUrl || null,
                  replyToWaMsgId: details.replyToWaMsgId || null,
                  reactionEmoji: details.reactionEmoji || null,
                  status: "DELIVERED",
                  statusRank: 2,
                  waTimestamp,
                },
                update: {
                  fileUrl: mediaResult?.fileUrl || undefined,
                  fileKey: mediaResult?.fileKey || undefined,
                },
              });

              await prisma.whatsAppWebhookEvent.update({
                where: { id: claim.eventRecordId },
                data: { status: "PROCESSED" },
              });
              processedEvents++;
            } catch (err: any) {
              errors.push(`Error processing inbound message ${wamid}: ${err.message}`);
              await prisma.whatsAppWebhookEvent.update({
                where: { id: claim.eventRecordId },
                data: { status: "FAILED", errorDetails: err.message },
              });
            }
          }
        }

        // 1B. Outbound message delivery/read status updates
        if (Array.isArray(value.statuses)) {
          for (const st of value.statuses) {
            const wamid = String(st.id || "");
            const rawStatus = String(st.status || "").toUpperCase();
            const ts = String(st.timestamp || "");
            if (!wamid || !rawStatus) continue;

            const idempotencyKey = `status:${wamid}:${rawStatus}:${ts}`;
            const claim = await claimWebhookIdempotency({
              idempotencyKey,
              eventType: "statuses",
              wabaId,
              phoneNumberId: account.phoneNumberId,
              waMessageId: wamid,
              payloadObj: st,
            });

            if (claim.alreadyProcessed) {
              skippedDuplicates++;
              continue;
            }

            try {
              const targetMsg = await prisma.whatsAppMessage.findUnique({
                where: { waMessageId: wamid },
              });

              if (targetMsg) {
                const incomingRank = getStatusRank(rawStatus);
                const currentRank = targetMsg.statusRank;

                // Monotonic progression guard: never downgrade READ -> DELIVERED or DELIVERED -> SENT
                const shouldUpdate =
                  (incomingRank > currentRank) ||
                  (incomingRank === -1 && currentRank <= 1);

                if (shouldUpdate) {
                  const errObj = Array.isArray(st.errors) && st.errors[0] ? st.errors[0] : null;
                  await prisma.whatsAppMessage.update({
                    where: { id: targetMsg.id },
                    data: {
                      status: rawStatus,
                      statusRank: incomingRank,
                      errorCode: errObj ? String(errObj.code || "") : targetMsg.errorCode,
                      errorMessage: errObj ? String(errObj.title || errObj.message || "") : targetMsg.errorMessage,
                    },
                  });
                }
              }

              await prisma.whatsAppWebhookEvent.update({
                where: { id: claim.eventRecordId },
                data: { status: "PROCESSED" },
              });
              processedEvents++;
            } catch (err: any) {
              errors.push(`Error processing status for ${wamid}: ${err.message}`);
              await prisma.whatsAppWebhookEvent.update({
                where: { id: claim.eventRecordId },
                data: { status: "FAILED", errorDetails: err.message },
              });
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // FIELD 2: smb_message_echoes (Manual Outbound Replies from Physical Phone)
      // ----------------------------------------------------------------------
      else if (field === "smb_message_echoes") {
        const echoes = Array.isArray(value.message_echoes) ? value.message_echoes : [];

        for (const echo of echoes) {
          const wamid = String(echo.id || "");
          if (!wamid) continue;

          const idempotencyKey = `echo:${wamid}`;
          const claim = await claimWebhookIdempotency({
            idempotencyKey,
            eventType: "smb_message_echoes",
            wabaId,
            phoneNumberId: account.phoneNumberId,
            waMessageId: wamid,
            payloadObj: echo,
          });

          if (claim.alreadyProcessed) {
            skippedDuplicates++;
            continue;
          }

          try {
            const customerWaId = normalizeWaId(echo.to || "");
            const waTimestamp = echo.timestamp
              ? new Date(Number(echo.timestamp) * 1000)
              : new Date();
            const details = extractMessageDetails(echo);

            // Update account lastEchoAt (proves physical phone is active for 14-day heartbeat!)
            await prisma.whatsAppAccount.update({
              where: { id: account.id },
              data: { lastEchoAt: waTimestamp },
            });

            // Handle edit/revoke from physical phone
            if ((details.isEdited || details.isRevoked) && details.targetWaMsgId) {
              const existingTarget = await prisma.whatsAppMessage.findUnique({
                where: { waMessageId: details.targetWaMsgId },
              });
              if (existingTarget) {
                await prisma.whatsAppMessage.update({
                  where: { id: existingTarget.id },
                  data: {
                    content: details.content,
                    isEdited: Boolean(details.isEdited),
                    isRevoked: Boolean(details.isRevoked),
                  },
                });
              }
              await prisma.whatsAppWebhookEvent.update({
                where: { id: claim.eventRecordId },
                data: { status: "PROCESSED" },
              });
              processedEvents++;
              continue;
            }

            let chat = await prisma.whatsAppChat.findUnique({
              where: {
                accountId_customerWaId: {
                  accountId: account.id,
                  customerWaId,
                },
              },
            });

            if (!chat) {
              chat = await prisma.whatsAppChat.create({
                data: {
                  accountId: account.id,
                  customerWaId,
                  customerPhone: formatDisplayPhone(customerWaId),
                  customerName: formatDisplayPhone(customerWaId),
                  status: "OPEN",
                  unreadCount: 0,
                  lastMessageAt: waTimestamp,
                  lastMessagePreview: `📱 ${details.content.slice(0, 150)}`,
                  lastMessageSource: "PHYSICAL_PHONE",
                },
              });
            } else {
              chat = await prisma.whatsAppChat.update({
                where: { id: chat.id },
                data: {
                  lastMessageAt:
                    waTimestamp > chat.lastMessageAt ? waTimestamp : chat.lastMessageAt,
                  lastMessagePreview: `📱 ${details.content.slice(0, 150)}`,
                  lastMessageSource: "PHYSICAL_PHONE",
                  version: { increment: 1 },
                },
              });
            }

            let mediaResult = null;
            if (details.mediaId && accessToken) {
              mediaResult = await downloadAndPersistWhatsAppMedia({
                mediaId: details.mediaId,
                accessToken,
                type: details.type,
                fileName: details.fileName,
                mimeType: details.mimeType,
                mockContentBase64: details.mockContentBase64,
              });
            }

            await prisma.whatsAppMessage.upsert({
              where: { waMessageId: wamid },
              create: {
                chatId: chat.id,
                waMessageId: wamid,
                direction: "OUTBOUND",
                source: "PHYSICAL_PHONE",
                sentByUserId: null,
                type: details.type,
                content: details.content,
                mediaId: details.mediaId || null,
                fileUrl: mediaResult?.fileUrl || null,
                fileKey: mediaResult?.fileKey || null,
                fileName: mediaResult?.fileName || details.fileName || null,
                fileSize: mediaResult?.fileSize || null,
                mimeType: mediaResult?.mimeType || details.mimeType || null,
                thumbnailUrl: mediaResult?.thumbnailUrl || null,
                replyToWaMsgId: details.replyToWaMsgId || null,
                reactionEmoji: details.reactionEmoji || null,
                status: "SENT",
                statusRank: 1,
                waTimestamp,
              },
              update: {},
            });

            await prisma.whatsAppWebhookEvent.update({
              where: { id: claim.eventRecordId },
              data: { status: "PROCESSED" },
            });
            processedEvents++;
          } catch (err: any) {
            errors.push(`Error processing smb_message_echo ${wamid}: ${err.message}`);
            await prisma.whatsAppWebhookEvent.update({
              where: { id: claim.eventRecordId },
              data: { status: "FAILED", errorDetails: err.message },
            });
          }
        }
      }

      // ----------------------------------------------------------------------
      // FIELD 3: history (One-Time 180-Day 1:1 Chat & 14-Day Media Backfill)
      // ----------------------------------------------------------------------
      else if (field === "history") {
        const metaPhase = value.metadata?.phase ?? 0;
        const chunkOrder = value.metadata?.chunk_order ?? 0;
        const progress = Number(value.metadata?.progress ?? 0);

        const chunkKey = `history:${account.phoneNumberId}:p${metaPhase}:c${chunkOrder}:prog${progress}`;
        const claim = await claimWebhookIdempotency({
          idempotencyKey: chunkKey,
          eventType: "history",
          wabaId,
          phoneNumberId: account.phoneNumberId,
          payloadObj: value,
        });

        if (claim.alreadyProcessed) {
          skippedDuplicates++;
          continue;
        }

        try {
          const threads = Array.isArray(value.threads) ? value.threads : [];
          const businessDigits = normalizeWaId(account.displayPhoneNumber);

          for (const thread of threads) {
            const customerWaId = normalizeWaId(thread.id || "");
            if (!customerWaId) continue;

            const threadMessages = Array.isArray(thread.messages) ? thread.messages : [];
            if (threadMessages.length === 0) continue;

            let chat = await prisma.whatsAppChat.findUnique({
              where: {
                accountId_customerWaId: {
                  accountId: account.id,
                  customerWaId,
                },
              },
            });

            if (!chat) {
              chat = await prisma.whatsAppChat.create({
                data: {
                  accountId: account.id,
                  customerWaId,
                  customerPhone: formatDisplayPhone(customerWaId),
                  customerName: thread.contact_name || formatDisplayPhone(customerWaId),
                  status: "OPEN",
                  unreadCount: 0,
                },
              });
            }

            let latestTs = chat.lastMessageAt;
            let latestPreview = chat.lastMessagePreview;

            for (const hMsg of threadMessages) {
              const wamid = String(hMsg.id || "");
              if (!wamid) continue;

              const fromDigits = normalizeWaId(hMsg.from || "");
              const isOutbound =
                fromDigits === businessDigits ||
                hMsg.history_context?.from_me === true ||
                hMsg.from_me === true;

              const waTimestamp = hMsg.timestamp
                ? new Date(Number(hMsg.timestamp) * 1000)
                : new Date();
              const details = extractMessageDetails(hMsg);

              let mediaResult = null;
              if (details.mediaId && accessToken) {
                mediaResult = await downloadAndPersistWhatsAppMedia({
                  mediaId: details.mediaId,
                  accessToken,
                  type: details.type,
                  fileName: details.fileName,
                  mimeType: details.mimeType,
                  mockContentBase64: details.mockContentBase64,
                });
              }

              const rawHistStatus = String(
                hMsg.history_context?.status || hMsg.status || "READ"
              ).toUpperCase();

              // Upsert without overwriting live messages or inflating unreadCount
              await prisma.whatsAppMessage.upsert({
                where: { waMessageId: wamid },
                create: {
                  chatId: chat.id,
                  waMessageId: wamid,
                  direction: isOutbound ? "OUTBOUND" : "INBOUND",
                  source: "HISTORY_SYNC",
                  type: details.type,
                  content: details.content,
                  mediaId: details.mediaId || null,
                  fileUrl: mediaResult?.fileUrl || null,
                  fileKey: mediaResult?.fileKey || null,
                  fileName: mediaResult?.fileName || details.fileName || null,
                  fileSize: mediaResult?.fileSize || null,
                  mimeType: mediaResult?.mimeType || details.mimeType || null,
                  thumbnailUrl: mediaResult?.thumbnailUrl || null,
                  replyToWaMsgId: details.replyToWaMsgId || null,
                  status: rawHistStatus,
                  statusRank: getStatusRank(rawHistStatus),
                  waTimestamp,
                },
                update: {},
              });

              if (waTimestamp >= latestTs) {
                latestTs = waTimestamp;
                latestPreview = details.content.slice(0, 160);
              }
            }

            await prisma.whatsAppChat.update({
              where: { id: chat.id },
              data: {
                lastMessageAt: latestTs,
                lastMessagePreview: latestPreview || chat.lastMessagePreview,
                lastMessageSource: chat.lastMessageSource || "HISTORY_SYNC",
              },
            });
          }

          await prisma.whatsAppAccount.update({
            where: { id: account.id },
            data: {
              historySyncProgress: Math.max(account.historySyncProgress, progress),
              historySyncStatus: progress >= 100 ? "COMPLETED" : "IN_PROGRESS",
            },
          });

          await prisma.whatsAppWebhookEvent.update({
            where: { id: claim.eventRecordId },
            data: { status: "PROCESSED" },
          });
          processedEvents++;
        } catch (err: any) {
          errors.push(`Error processing history chunk: ${err.message}`);
          await prisma.whatsAppWebhookEvent.update({
            where: { id: claim.eventRecordId },
            data: { status: "FAILED", errorDetails: err.message },
          });
        }
      }

      // ----------------------------------------------------------------------
      // FIELD 4: smb_app_state_sync (Physical Phone Address Book Contacts)
      // ----------------------------------------------------------------------
      else if (field === "smb_app_state_sync") {
        const syncItems = Array.isArray(value.state_sync) ? value.state_sync : [];

        for (const item of syncItems) {
          if (item.type !== "contact") continue;
          const contactWaId = normalizeWaId(item.contact?.phone_number || "");
          const fullName = item.contact?.full_name || item.contact?.first_name || "";
          const action = String(item.action || "add");
          const ts = String(item.metadata?.timestamp || "");
          if (!contactWaId) continue;

          const idempotencyKey = `contact:${account.phoneNumberId}:${contactWaId}:${action}:${ts}`;
          const claim = await claimWebhookIdempotency({
            idempotencyKey,
            eventType: "smb_app_state_sync",
            wabaId,
            phoneNumberId: account.phoneNumberId,
            payloadObj: item,
          });

          if (claim.alreadyProcessed) {
            skippedDuplicates++;
            continue;
          }

          try {
            if (action !== "remove" && fullName) {
              await prisma.whatsAppChat.updateMany({
                where: {
                  accountId: account.id,
                  customerWaId: contactWaId,
                },
                data: {
                  customerName: fullName,
                },
              });
            }

            await prisma.whatsAppAccount.update({
              where: { id: account.id },
              data: { contactSyncStatus: "COMPLETED" },
            });

            await prisma.whatsAppWebhookEvent.update({
              where: { id: claim.eventRecordId },
              data: { status: "PROCESSED" },
            });
            processedEvents++;
          } catch (err: any) {
            errors.push(`Error processing contact sync for ${contactWaId}: ${err.message}`);
            await prisma.whatsAppWebhookEvent.update({
              where: { id: claim.eventRecordId },
              data: { status: "FAILED", errorDetails: err.message },
            });
          }
        }
      }

      // ----------------------------------------------------------------------
      // FIELD 5: account_update (Coexistence Connection Health & Lifecycle)
      // ----------------------------------------------------------------------
      else if (field === "account_update") {
        const eventName = String(value.event || "UNKNOWN");
        const idempotencyKey = `account:${wabaId}:${eventName}:${crypto
          .createHash("sha256")
          .update(JSON.stringify(value))
          .digest("hex")
          .slice(0, 16)}`;

        const claim = await claimWebhookIdempotency({
          idempotencyKey,
          eventType: "account_update",
          wabaId,
          phoneNumberId: account.phoneNumberId,
          payloadObj: value,
        });

        if (claim.alreadyProcessed) {
          skippedDuplicates++;
          continue;
        }

        try {
          let nextStatus = account.status;
          if (eventName === "ACCOUNT_OFFBOARDED" || eventName === "DISCONNECTED") {
            nextStatus = "DISCONNECTED";
          } else if (eventName === "PRIMARY_INACTIVITY") {
            nextStatus = "INACTIVE_WARNING";
          } else if (eventName === "PARTNER_ADDED" || eventName === "VERIFIED_ACCOUNT") {
            nextStatus = "CONNECTED";
          }

          await prisma.whatsAppAccount.update({
            where: { id: account.id },
            data: { status: nextStatus },
          });

          await prisma.auditLog.create({
            data: {
              action: `WHATSAPP_ACCOUNT_${eventName}`,
              details: `Meta account_update webhook received for WABA ${wabaId}: status=${nextStatus}`,
            },
          });

          await prisma.whatsAppWebhookEvent.update({
            where: { id: claim.eventRecordId },
            data: { status: "PROCESSED" },
          });
          processedEvents++;
        } catch (err: any) {
          errors.push(`Error processing account_update (${eventName}): ${err.message}`);
          await prisma.whatsAppWebhookEvent.update({
            where: { id: claim.eventRecordId },
            data: { status: "FAILED", errorDetails: err.message },
          });
        }
      }
    }
  }

  return { processedEvents, skippedDuplicates, errors };
}

/**
 * Sends an outbound WhatsApp message from a ConnectPro employee via Meta Cloud API.
 */
export async function sendWhatsAppReply(params: {
  chatId: string;
  senderUserId: string;
  content: string;
  type?: string;
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  replyToWaMsgId?: string;
  templateName?: string;
  templateLanguage?: string;
}) {
  const {
    chatId,
    senderUserId,
    content,
    type = "TEXT",
    fileUrl,
    fileKey,
    fileName,
    fileSize,
    mimeType,
    replyToWaMsgId,
    templateName,
    templateLanguage = "en_US",
  } = params;

  const chat = await prisma.whatsAppChat.findUnique({
    where: { id: chatId },
    include: { account: true },
  });

  if (!chat || !chat.account) {
    throw new Error("WhatsApp chat or connected account not found.");
  }

  if (chat.account.status === "DISCONNECTED") {
    throw new Error("WhatsApp Business account is currently disconnected.");
  }

  // Enforce Meta's 24-hour customer service window for free-form messages
  const windowCheck = isWithin24HourServiceWindow(chat.lastCustomerMsgAt);
  if (!windowCheck.isOpen && !templateName) {
    throw new Error(
      "Outside the 24-hour customer service window. Free-form API messages are blocked by Meta until the customer messages again, or you can send an approved Template message (or reply manually from the physical WhatsApp phone)."
    );
  }

  const accessToken = decryptAccessToken(chat.account.accessTokenEncrypted);
  const phoneNumberId = chat.account.phoneNumberId;

  let waMessageId = `wamid.cp_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

  // If connected to a real Meta phoneNumberId (not a local test_ sandbox account), call Meta Graph API
  if (!phoneNumberId.startsWith("test_")) {
    const metaPayload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: chat.customerWaId,
    };

    if (replyToWaMsgId) {
      metaPayload.context = { message_id: replyToWaMsgId };
    }

    if (templateName) {
      metaPayload.type = "template";
      metaPayload.template = {
        name: templateName,
        language: { code: templateLanguage },
      };
    } else if (type === "TEXT") {
      metaPayload.type = "text";
      metaPayload.text = { preview_url: false, body: content };
    } else {
      const mediaTypeLower =
        type === "VOICE" ? "audio" : type.toLowerCase();
      metaPayload.type = mediaTypeLower;
      metaPayload[mediaTypeLower] = {
        link: fileUrl,
        ...(type !== "AUDIO" && type !== "VOICE" && content ? { caption: content } : {}),
        ...(type === "DOCUMENT" && fileName ? { filename: fileName } : {}),
      };
    }

    const res = await fetch(
      `${META_GRAPH_BASE_URL}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const resData = await res.json();
    if (!res.ok) {
      const metaErrMsg =
        resData?.error?.message || `Meta Cloud API error (HTTP ${res.status})`;
      throw new Error(metaErrMsg);
    }

    if (resData?.messages?.[0]?.id) {
      waMessageId = String(resData.messages[0].id);
    }
  }

  const now = new Date();
  const createdMessage = await prisma.whatsAppMessage.create({
    data: {
      chatId: chat.id,
      waMessageId,
      direction: "OUTBOUND",
      source: "CONNECTPRO",
      sentByUserId: senderUserId,
      type,
      content,
      fileUrl: fileUrl || null,
      fileKey: fileKey || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      mimeType: mimeType || null,
      replyToWaMsgId: replyToWaMsgId || null,
      status: "SENT",
      statusRank: 1,
      waTimestamp: now,
    },
    include: {
      sentBy: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          department: true,
        },
      },
    },
  });

  await prisma.whatsAppChat.update({
    where: { id: chat.id },
    data: {
      lastMessageAt: now,
      lastMessagePreview: content.slice(0, 160),
      lastMessageSource: "CONNECTPRO",
      unreadCount: 0,
      version: { increment: 1 },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: senderUserId,
      action: "WHATSAPP_MESSAGE_SENT",
      details: `Sent WhatsApp ${type} reply (${waMessageId}) to ${chat.customerPhone}`,
    },
  });

  return createdMessage;
}
