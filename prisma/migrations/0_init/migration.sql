-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "avatar" TEXT,
    "createdById" TEXT,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "readAt" TIMESTAMP(3),

    CONSTRAINT "MessageReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AUDIO',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "temporaryFileDays" INTEGER NOT NULL DEFAULT 7,
    "voiceRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "callLogRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "groupFileRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "autoPurgeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "warningThreshold" INTEGER NOT NULL DEFAULT 70,
    "criticalThreshold" INTEGER NOT NULL DEFAULT 85,
    "emergencyThreshold" INTEGER NOT NULL DEFAULT 95,
    "storageQuotaBytes" DOUBLE PRECISION NOT NULL DEFAULT 10737418240,
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "policyName" TEXT,
    "itemsPurged" INTEGER NOT NULL DEFAULT 0,
    "bytesFreed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "executedById" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_isOnline_idx" ON "User"("isOnline");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_isGroup_idx" ON "Conversation"("isGroup");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE INDEX "ConversationMember_conversationId_idx" ON "ConversationMember"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_type_idx" ON "Message"("type");

-- CreateIndex
CREATE INDEX "Message_fileSize_idx" ON "Message"("fileSize");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_isTemporary_idx" ON "Message"("isTemporary");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReceipt_messageId_userId_key" ON "MessageReceipt"("messageId", "userId");

-- CreateIndex
CREATE INDEX "CallLog_callerId_idx" ON "CallLog"("callerId");

-- CreateIndex
CREATE INDEX "CallLog_receiverId_idx" ON "CallLog"("receiverId");

-- CreateIndex
CREATE INDEX "CallLog_startedAt_idx" ON "CallLog"("startedAt");

-- CreateIndex
CREATE INDEX "StorageAuditLog_createdAt_idx" ON "StorageAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageAuditLog" ADD CONSTRAINT "StorageAuditLog_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
