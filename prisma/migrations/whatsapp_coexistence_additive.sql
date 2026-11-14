-- ============================================================================
-- ConnectPro — Phase 3A Additive Migration SQL (WhatsApp Coexistence)
-- Safety: Strictly additive (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)
-- Zero ALTER, DROP, RENAME, or TRUNCATE statements on any existing tables.
-- ============================================================================

-- 1. WhatsAppAccount: Stores connected WABA & Coexistence phone configuration
CREATE TABLE IF NOT EXISTS "WhatsAppAccount" (
  "id"                   TEXT PRIMARY KEY,
  "wabaId"               TEXT UNIQUE NOT NULL,
  "phoneNumberId"        TEXT UNIQUE NOT NULL,
  "displayPhoneNumber"   TEXT NOT NULL,
  "verifiedName"         TEXT,
  "accessTokenEncrypted" TEXT NOT NULL,
  "coexistenceEnabled"   BOOLEAN NOT NULL DEFAULT true,
  "status"               TEXT NOT NULL DEFAULT 'CONNECTED',
  "appVersionConfirmed"  TEXT,
  "historySyncStatus"    TEXT NOT NULL DEFAULT 'PENDING',
  "historySyncProgress"  INTEGER NOT NULL DEFAULT 0,
  "historyTriggeredAt"   TIMESTAMP(3),
  "contactSyncStatus"    TEXT NOT NULL DEFAULT 'PENDING',
  "lastWebhookAt"        TIMESTAMP(3),
  "lastEchoAt"           TIMESTAMP(3),
  "connectedByUserId"    TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppAccount_connectedByUserId_fkey"
    FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppAccount_wabaId_key" ON "WhatsAppAccount"("wabaId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppAccount_phoneNumberId_key" ON "WhatsAppAccount"("phoneNumberId");
CREATE INDEX IF NOT EXISTS "WhatsAppAccount_status_idx" ON "WhatsAppAccount"("status");

-- 2. WhatsAppChat: Stores external 1:1 WhatsApp customer conversation threads
CREATE TABLE IF NOT EXISTS "WhatsAppChat" (
  "id"                 TEXT PRIMARY KEY,
  "accountId"          TEXT NOT NULL,
  "customerWaId"       TEXT NOT NULL,
  "customerPhone"      TEXT NOT NULL,
  "customerName"       TEXT,
  "customerAvatar"     TEXT,
  "assignedToUserId"   TEXT,
  "status"             TEXT NOT NULL DEFAULT 'OPEN',
  "unreadCount"        INTEGER NOT NULL DEFAULT 0,
  "lastCustomerMsgAt"  TIMESTAMP(3),
  "lastMessageAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessagePreview" TEXT,
  "lastMessageSource"  TEXT,
  "isPinned"           BOOLEAN NOT NULL DEFAULT false,
  "isArchived"         BOOLEAN NOT NULL DEFAULT false,
  "version"            INTEGER NOT NULL DEFAULT 1,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppChat_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppChat_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppChat_accountId_customerWaId_key" ON "WhatsAppChat"("accountId", "customerWaId");
CREATE INDEX IF NOT EXISTS "WhatsAppChat_accountId_lastMessageAt_idx" ON "WhatsAppChat"("accountId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "WhatsAppChat_assignedToUserId_lastMessageAt_idx" ON "WhatsAppChat"("assignedToUserId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "WhatsAppChat_status_lastMessageAt_idx" ON "WhatsAppChat"("status", "lastMessageAt" DESC);

-- 3. WhatsAppMessage: Stores inbound customer messages, ConnectPro replies, phone echoes & history sync
CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id"             TEXT PRIMARY KEY,
  "chatId"         TEXT NOT NULL,
  "waMessageId"    TEXT UNIQUE NOT NULL,
  "direction"      TEXT NOT NULL,
  "source"         TEXT NOT NULL,
  "sentByUserId"   TEXT,
  "type"           TEXT NOT NULL DEFAULT 'TEXT',
  "content"        TEXT NOT NULL DEFAULT '',
  "mediaId"        TEXT,
  "fileUrl"        TEXT,
  "fileKey"        TEXT,
  "fileName"       TEXT,
  "fileSize"       INTEGER,
  "mimeType"       TEXT,
  "thumbnailUrl"   TEXT,
  "replyToWaMsgId" TEXT,
  "reactionEmoji"  TEXT,
  "status"         TEXT NOT NULL DEFAULT 'SENT',
  "statusRank"     INTEGER NOT NULL DEFAULT 1,
  "errorCode"      TEXT,
  "errorMessage"   TEXT,
  "isEdited"       BOOLEAN NOT NULL DEFAULT false,
  "isRevoked"      BOOLEAN NOT NULL DEFAULT false,
  "waTimestamp"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessage_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "WhatsAppChat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppMessage_sentByUserId_fkey"
    FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_chatId_waTimestamp_idx" ON "WhatsAppMessage"("chatId", "waTimestamp" ASC);
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_sentByUserId_idx" ON "WhatsAppMessage"("sentByUserId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_source_idx" ON "WhatsAppMessage"("source");

-- 4. WhatsAppInternalNote: Stores internal employee team notes on a WhatsApp chat (never sent to customer)
CREATE TABLE IF NOT EXISTS "WhatsAppInternalNote" (
  "id"        TEXT PRIMARY KEY,
  "chatId"    TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppInternalNote_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "WhatsAppChat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppInternalNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WhatsAppInternalNote_chatId_createdAt_idx" ON "WhatsAppInternalNote"("chatId", "createdAt" ASC);

-- 5. WhatsAppWebhookEvent: Stores atomic webhook idempotency keys, retry states & raw payloads
CREATE TABLE IF NOT EXISTS "WhatsAppWebhookEvent" (
  "id"             TEXT PRIMARY KEY,
  "idempotencyKey" TEXT UNIQUE NOT NULL,
  "eventType"      TEXT NOT NULL,
  "wabaId"         TEXT,
  "phoneNumberId"  TEXT,
  "waMessageId"    TEXT,
  "status"         TEXT NOT NULL DEFAULT 'PROCESSED',
  "retryCount"     INTEGER NOT NULL DEFAULT 0,
  "payloadJson"    TEXT NOT NULL,
  "errorDetails"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_idempotencyKey_key" ON "WhatsAppWebhookEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_eventType_createdAt_idx" ON "WhatsAppWebhookEvent"("eventType", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_waMessageId_idx" ON "WhatsAppWebhookEvent"("waMessageId");
