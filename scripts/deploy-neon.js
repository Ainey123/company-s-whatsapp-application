/**
 * ConnectPro - Neon PostgreSQL Deployment & Initialization Script
 * 
 * Safely deploys schema migrations to Neon PostgreSQL and
 * initializes the database with enterprise departments and Super Admin.
 * 
 * Safety: Never drops tables or deletes existing data.
 */

const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("========================================================");
  console.log("   CONNECTPRO - NEON POSTGRESQL PRODUCTION DEPLOYMENT   ");
  console.log("========================================================\n");

  // 1. Check environment variables
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL || dbUrl;

  if (!dbUrl) {
    console.error("❌ ERROR: DATABASE_URL is not set.");
    console.error("Please set DATABASE_URL (and DIRECT_URL) in your environment or .env file.");
    process.exit(1);
  }

  console.log("📡 Target Database:", dbUrl.replace(/:[^:@]+@/, ":****@"));
  if (process.env.DIRECT_URL) {
    console.log("🔗 Direct Migration URL:", directUrl.replace(/:[^:@]+@/, ":****@"));
  }

  // 2. Run Prisma Migration Deploy
  console.log("\n📦 Step 1: Applying Prisma migrations to Neon...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
    console.log("✅ Migrations applied successfully.\n");
  } catch (err) {
    console.error("❌ Failed to apply migrations:", err.message);
    process.exit(1);
  }

  // 3. Connect Prisma Client to check and seed initial data safely
  console.log("🌱 Step 2: Checking initial workspace configuration...");
  const prisma = new PrismaClient();

  try {
    // 3a. Seed Standard Corporate Departments (Idempotent: only creates if missing)
    const departments = [
      { name: "Executive Leadership", description: "Executive leadership, corporate strategy, and board operations" },
      { name: "Product & Engineering", description: "Software architecture, development, QA, devops, and infrastructure" },
      { name: "Design & UX", description: "User interface, product design, brand identity, and user research" },
      { name: "Marketing & Growth", description: "Digital marketing, campaigns, branding, and content creation" },
      { name: "Finance & Accounting", description: "Financial management, accounting, budgeting, and audits" },
      { name: "People & HR", description: "Human resources, talent acquisition, culture, and employee success" },
      { name: "Customer Operations", description: "Customer support, client success, and technical onboarding" },
      { name: "Legal & Compliance", description: "Regulatory compliance, data protection, and legal counsel" },
    ];

    let createdDepts = 0;
    for (const dep of departments) {
      const existing = await prisma.department.findUnique({ where: { name: dep.name } });
      if (!existing) {
        await prisma.department.create({ data: dep });
        createdDepts++;
      }
    }
    console.log(`✅ Departments verified (${createdDepts} newly added, ${departments.length - createdDepts} existing).`);

    // 3b. Verify or Create Default Super Admin (Requires ADMIN_INITIAL_PASSWORD in production)
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [{ username: "admin" }, { email: "admin@connectpro.internal" }],
      },
    });

    const adminPassword = (process.env.ADMIN_INITIAL_PASSWORD || "").trim();

    if (!adminPassword || adminPassword === "admin123") {
      console.error(
        "❌ SECURITY ERROR: Set a strong ADMIN_INITIAL_PASSWORD environment variable (cannot be empty or 'admin123') before running production deployment."
      );
      process.exit(1);
    }

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const superAdmin = await prisma.user.create({
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
          passwordHash,
        },
      });
      console.log(`✅ Created Primary Super Administrator: ${superAdmin.displayName} (@${superAdmin.username})`);

      // 3c. Create General Company Announcements Group
      const generalGroup = await prisma.conversation.create({
        data: {
          isGroup: true,
          name: "🚀 Company Announcements",
          description: "Official company updates, milestone celebrations, and workspace announcements.",
          avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
          createdById: superAdmin.id,
          members: {
            create: [
              {
                userId: superAdmin.id,
                role: "ADMIN",
                isPinned: true,
              },
            ],
          },
        },
      });

      // Welcome message
      await prisma.message.create({
        data: {
          conversationId: generalGroup.id,
          senderId: superAdmin.id,
          content: "Welcome to ConnectPro! 🎉 Connected to Neon PostgreSQL production database.",
          type: "TEXT",
        },
      });

      // Default Retention Policy
      await prisma.retentionPolicy.create({
        data: {
          temporaryFileDays: 7,
          voiceRetentionDays: 90,
          callLogRetentionDays: 180,
          groupFileRetentionDays: 365,
          storageQuotaBytes: 53687091200, // 50 GB
          warningThreshold: 70,
          criticalThreshold: 85,
          emergencyThreshold: 95,
          autoPurgeEnabled: false,
        },
      });

      console.log("✅ Created 'Company Announcements' group and default Retention Policy.");
    } else {
      const hasValidBcryptPrefix =
        typeof existingAdmin.passwordHash === "string" &&
        existingAdmin.passwordHash.startsWith("$2");
      const isLegacyDefault =
        !hasValidBcryptPrefix ||
        (await bcrypt.compare("admin123", existingAdmin.passwordHash));
      if (isLegacyDefault) {
        const rotatedHash = await bcrypt.hash(adminPassword, 10);
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { passwordHash: rotatedHash },
        });
        console.log("✅ Rotated legacy Super Administrator password to ADMIN_INITIAL_PASSWORD.");
      } else {
        console.log(`ℹ️ Super Administrator already exists: ${existingAdmin.displayName} (@${existingAdmin.username}). Preserved.`);
      }
    }

    console.log("\n========================================================");
    console.log("   NEON POSTGRESQL DEPLOYMENT COMPLETED SUCCESSFULLY    ");
    console.log("========================================================");
    if (!existingAdmin) {
      console.log("  Default Username: admin (or admin@connectpro.internal)");
      console.log(`  Default Password: ${adminPassword}`);
      console.log("========================================================\n");
    }
  } catch (err) {
    console.error("❌ Database initialization error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
