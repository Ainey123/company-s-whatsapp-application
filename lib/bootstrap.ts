import prisma from "./prisma";
import bcrypt from "bcryptjs";

let bootstrapPromise: Promise<void> | null = null;

export async function ensureDatabaseReady(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap();
  }
  return bootstrapPromise;
}

async function runBootstrap(): Promise<void> {
  try {
    // 1. Test if User table exists
    await prisma.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1');
  } catch (err: any) {
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
    const adminHash = await bcrypt.hash("admin123", 10);
    let admin = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "admin" },
          { email: "admin@connectpro.internal" },
        ],
      },
    });

    if (!admin) {
      console.log("🌱 Creating default Super Admin account (admin / admin123)...");
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
  ];

  for (const sql of ddlStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
      console.warn("DDL statement warning:", e.message);
    }
  }
}
