import prisma from "./prisma";
import bcrypt from "bcryptjs";

let bootstrapPromise: Promise<void> | null = null;

export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_ENV)
  );
}

export async function ensureDatabaseReady(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap();
  }
  return bootstrapPromise;
}

async function runBootstrap(): Promise<void> {
  try {
    // 1. Test if User and WhatsAppAccount tables exist
    await prisma.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1');
    await prisma.$queryRawUnsafe('SELECT 1 FROM "WhatsAppAccount" LIMIT 1');
  } catch (err: any) {
    const errMsg = String(err?.message || "");
    if (
      err?.code === "P1001" ||
      errMsg.includes("Can't reach database server") ||
      errMsg.includes("ECONNREFUSED")
    ) {
      bootstrapPromise = null;
      return;
    }
    // Table missing in PostgreSQL (42P01 or P2021) -> Auto-create all tables
    console.log("⚠️ Tables missing in database. Running auto-bootstrap schema initialization...");
    try {
      await initializeTables();
    } catch (createErr: any) {
      console.error("Auto-bootstrap table creation error:", createErr);
    }
  }

  // 2. Ensure initial Super Admin and basic workspace data exist
  try {
    const isProd = isProductionEnvironment();
    const envAdminPassword = (process.env.ADMIN_INITIAL_PASSWORD || "").trim();
    const effectiveAdminPassword = isProd
      ? envAdminPassword
      : envAdminPassword || "admin123";

    let admin = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: "admin", mode: "insensitive" } },
          { email: { equals: "admin@connectpro.internal", mode: "insensitive" } },
        ],
      },
    });

    if (!admin) {
      if (!effectiveAdminPassword) {
        console.error(
          "❌ SECURITY: ADMIN_INITIAL_PASSWORD environment variable is required in production to create the initial Super Admin account."
        );
        return;
      }
      if (isProd && effectiveAdminPassword === "admin123") {
        console.error(
          "❌ SECURITY: ADMIN_INITIAL_PASSWORD cannot be set to 'admin123' in production."
        );
        return;
      }

      console.log("🌱 Creating initial Super Admin account...");
      const adminHash = await bcrypt.hash(effectiveAdminPassword, 10);
      admin = await prisma.user.create({
        data: {
          username: "admin",
          email: "admin@connectpro.internal",
          phone: "+1-555-0100",
          displayName: "System Administrator",
          designation: "Head of Infrastructure & IT",
          department: "Executive Leadership",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          passwordHash: adminHash,
        },
      });
    } else if (envAdminPassword && envAdminPassword !== "admin123") {
      // Rotate legacy 'admin123' or corrupted password hash to ADMIN_INITIAL_PASSWORD
      const hasValidBcryptPrefix =
        typeof admin.passwordHash === "string" && admin.passwordHash.startsWith("$2");
      const isLegacyDefault =
        !hasValidBcryptPrefix || (await bcrypt.compare("admin123", admin.passwordHash));
      if (isLegacyDefault) {
        const rotatedHash = await bcrypt.hash(envAdminPassword, 10);
        admin = await prisma.user.update({
          where: { id: admin.id },
          data: { passwordHash: rotatedHash },
        });
        console.log("✅ SECURITY: Rotated legacy Super Admin password hash to ADMIN_INITIAL_PASSWORD.");
      }
    }

    const deptCount = await prisma.department.count();
    if (deptCount === 0) {
      const depts = [
        "Executive Leadership",
        "Product & Engineering",
        "Design & UX",
        "Marketing & Growth",
        "Finance & Accounting",
        "People & HR",
        "Customer Operations",
        "Legal & Compliance",
      ];
      for (const name of depts) {
        await prisma.department.create({ data: { name } });
      }

      // Default announcement group
      const generalGroup = await prisma.conversation.create({
        data: {
          isGroup: true,
          name: "🚀 Company Announcements",
          description: "Official company updates and workspace announcements.",
          avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
          createdById: admin.id,
          members: {
            create: [
              {
                userId: admin.id,
                role: "ADMIN",
                isPinned: true,
              },
            ],
          },
        },
      });

      await prisma.message.create({
        data: {
          conversationId: generalGroup.id,
          senderId: admin.id,
          content: "Welcome to ConnectPro! 🎉 Company messaging workspace initialized.",
          type: "TEXT",
        },
      });

      await prisma.retentionPolicy.create({
        data: {
          temporaryFileDays: 7,
          voiceRetentionDays: 90,
          callLogRetentionDays: 180,
          groupFileRetentionDays: 365,
          storageQuotaBytes: 53687091200,
          warningThreshold: 70,
          criticalThreshold: 85,
          emergencyThreshold: 95,
          autoPurgeEnabled: false,
        },
      });

      console.log("✅ Auto-bootstrap complete. Super Admin initialized: +1-555-0100");
    }
  } catch (seedErr) {
    console.error("Auto-bootstrap seed check error:", seedErr);
  }
}

async function initializeTables(): Promise<void> {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "username" TEXT UNIQUE NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "phone" TEXT UNIQUE NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "avatar" TEXT,
      "designation" TEXT,
      "department" TEXT,
      "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "isOnline" BOOLEAN NOT NULL DEFAULT false,
      "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Department" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT UNIQUE NOT NULL,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Conversation" (
      "id" TEXT PRIMARY KEY,
      "isGroup" BOOLEAN NOT NULL DEFAULT false,
      "name" TEXT,
      "description" TEXT,
      "avatar" TEXT,
      "createdById" TEXT,
      "isImportant" BOOLEAN NOT NULL DEFAULT false,
      "retentionDays" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ConversationMember" (
      "id" TEXT PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'MEMBER',
      "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isMuted" BOOLEAN NOT NULL DEFAULT false,
      "isArchived" BOOLEAN NOT NULL DEFAULT false,
      "isPinned" BOOLEAN NOT NULL DEFAULT false,
      "isImportant" BOOLEAN NOT NULL DEFAULT false,
      "unreadCount" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "ConversationMember_conversationId_userId_key" UNIQUE ("conversationId", "userId")
    )`,
    `CREATE TABLE IF NOT EXISTS "Message" (
      "id" TEXT PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "senderId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'TEXT',
      "fileUrl" TEXT,
      "fileKey" TEXT,
      "fileName" TEXT,
      "fileSize" INTEGER,
      "mimeType" TEXT,
      "thumbnailUrl" TEXT,
      "isTemporary" BOOLEAN NOT NULL DEFAULT false,
      "isImportant" BOOLEAN NOT NULL DEFAULT false,
      "replyToId" TEXT,
      "isEdited" BOOLEAN NOT NULL DEFAULT false,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "MessageReceipt" (
      "id" TEXT PRIMARY KEY,
      "messageId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'SENT',
      "readAt" TIMESTAMP(3),
      CONSTRAINT "MessageReceipt_messageId_userId_key" UNIQUE ("messageId", "userId")
    )`,
    `CREATE TABLE IF NOT EXISTS "CallLog" (
      "id" TEXT PRIMARY KEY,
      "callerId" TEXT NOT NULL,
      "receiverId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'AUDIO',
      "status" TEXT NOT NULL DEFAULT 'COMPLETED',
      "durationSec" INTEGER NOT NULL DEFAULT 0,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endedAt" TIMESTAMP(3)
    )`,
    `CREATE TABLE IF NOT EXISTS "RetentionPolicy" (
      "id" TEXT PRIMARY KEY,
      "temporaryFileDays" INTEGER NOT NULL DEFAULT 7,
      "voiceRetentionDays" INTEGER NOT NULL DEFAULT 90,
      "callLogRetentionDays" INTEGER NOT NULL DEFAULT 180,
      "groupFileRetentionDays" INTEGER NOT NULL DEFAULT 365,
      "autoPurgeEnabled" BOOLEAN NOT NULL DEFAULT false,
      "warningThreshold" INTEGER NOT NULL DEFAULT 70,
      "criticalThreshold" INTEGER NOT NULL DEFAULT 85,
      "emergencyThreshold" INTEGER NOT NULL DEFAULT 95,
      "storageQuotaBytes" DOUBLE PRECISION NOT NULL DEFAULT 53687091200,
      "lastRunAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "StorageAuditLog" (
      "id" TEXT PRIMARY KEY,
      "action" TEXT NOT NULL,
      "policyName" TEXT,
      "itemsPurged" INTEGER NOT NULL DEFAULT 0,
      "bytesFreed" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "executedById" TEXT,
      "details" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT,
      "action" TEXT NOT NULL,
      "details" TEXT,
      "ipAddress" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "WhatsAppAccount" (
      "id" TEXT PRIMARY KEY,
      "wabaId" TEXT UNIQUE NOT NULL,
      "phoneNumberId" TEXT UNIQUE NOT NULL,
      "displayPhoneNumber" TEXT NOT NULL,
      "verifiedName" TEXT,
      "accessTokenEncrypted" TEXT NOT NULL,
      "coexistenceEnabled" BOOLEAN NOT NULL DEFAULT true,
      "status" TEXT NOT NULL DEFAULT 'CONNECTED',
      "appVersionConfirmed" TEXT,
      "historySyncStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "historySyncProgress" INTEGER NOT NULL DEFAULT 0,
      "historyTriggeredAt" TIMESTAMP(3),
      "contactSyncStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "lastWebhookAt" TIMESTAMP(3),
      "lastEchoAt" TIMESTAMP(3),
      "connectedByUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WhatsAppAccount_connectedByUserId_fkey"
        FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppAccount_wabaId_key" ON "WhatsAppAccount"("wabaId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppAccount_phoneNumberId_key" ON "WhatsAppAccount"("phoneNumberId")`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppAccount_status_idx" ON "WhatsAppAccount"("status")`,
    `CREATE TABLE IF NOT EXISTS "WhatsAppChat" (
      "id" TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "customerWaId" TEXT NOT NULL,
      "customerPhone" TEXT NOT NULL,
      "customerName" TEXT,
      "customerAvatar" TEXT,
      "assignedToUserId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "unreadCount" INTEGER NOT NULL DEFAULT 0,
      "lastCustomerMsgAt" TIMESTAMP(3),
      "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastMessagePreview" TEXT,
      "lastMessageSource" TEXT,
      "isPinned" BOOLEAN NOT NULL DEFAULT false,
      "isArchived" BOOLEAN NOT NULL DEFAULT false,
      "version" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WhatsAppChat_accountId_customerWaId_key" UNIQUE ("accountId", "customerWaId"),
      CONSTRAINT "WhatsAppChat_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WhatsAppChat_assignedToUserId_fkey"
        FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppChat_accountId_customerWaId_key" ON "WhatsAppChat"("accountId", "customerWaId")`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppChat_accountId_lastMessageAt_idx" ON "WhatsAppChat"("accountId", "lastMessageAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppChat_assignedToUserId_lastMessageAt_idx" ON "WhatsAppChat"("assignedToUserId", "lastMessageAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppChat_status_lastMessageAt_idx" ON "WhatsAppChat"("status", "lastMessageAt" DESC)`,
    `CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
      "id" TEXT PRIMARY KEY,
      "chatId" TEXT NOT NULL,
      "waMessageId" TEXT UNIQUE NOT NULL,
      "direction" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "sentByUserId" TEXT,
      "type" TEXT NOT NULL DEFAULT 'TEXT',
      "content" TEXT NOT NULL DEFAULT '',
      "mediaId" TEXT,
      "fileUrl" TEXT,
      "fileKey" TEXT,
      "fileName" TEXT,
      "fileSize" INTEGER,
      "mimeType" TEXT,
      "thumbnailUrl" TEXT,
      "replyToWaMsgId" TEXT,
      "reactionEmoji" TEXT,
      "status" TEXT NOT NULL DEFAULT 'SENT',
      "statusRank" INTEGER NOT NULL DEFAULT 1,
      "errorCode" TEXT,
      "errorMessage" TEXT,
      "isEdited" BOOLEAN NOT NULL DEFAULT false,
      "isRevoked" BOOLEAN NOT NULL DEFAULT false,
      "waTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WhatsAppMessage_chatId_fkey"
        FOREIGN KEY ("chatId") REFERENCES "WhatsAppChat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WhatsAppMessage_sentByUserId_fkey"
        FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId")`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppMessage_chatId_waTimestamp_idx" ON "WhatsAppMessage"("chatId", "waTimestamp" ASC)`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppMessage_sentByUserId_idx" ON "WhatsAppMessage"("sentByUserId")`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppMessage_source_idx" ON "WhatsAppMessage"("source")`,
    `CREATE TABLE IF NOT EXISTS "WhatsAppInternalNote" (
      "id" TEXT PRIMARY KEY,
      "chatId" TEXT NOT NULL,
      "authorId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WhatsAppInternalNote_chatId_fkey"
        FOREIGN KEY ("chatId") REFERENCES "WhatsAppChat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WhatsAppInternalNote_authorId_fkey"
        FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppInternalNote_chatId_createdAt_idx" ON "WhatsAppInternalNote"("chatId", "createdAt" ASC)`,
    `CREATE TABLE IF NOT EXISTS "WhatsAppWebhookEvent" (
      "id" TEXT PRIMARY KEY,
      "idempotencyKey" TEXT UNIQUE NOT NULL,
      "eventType" TEXT NOT NULL,
      "wabaId" TEXT,
      "phoneNumberId" TEXT,
      "waMessageId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PROCESSED',
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "payloadJson" TEXT NOT NULL,
      "errorDetails" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_idempotencyKey_key" ON "WhatsAppWebhookEvent"("idempotencyKey")`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_eventType_createdAt_idx" ON "WhatsAppWebhookEvent"("eventType", "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_waMessageId_idx" ON "WhatsAppWebhookEvent"("waMessageId")`,
  ];

  for (const sql of ddlStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
      console.warn("DDL statement warning:", e.message);
    }
  }
}
