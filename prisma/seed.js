const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Initializing ConnectPro Clean Enterprise Database...");

  // 1. Clean existing records in correct relation order
  await prisma.auditLog.deleteMany();
  await prisma.callLog.deleteMany();
  await prisma.messageReceipt.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // 2. Standard Enterprise Departments
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

  for (const dep of departments) {
    await prisma.department.create({ data: dep });
  }
  console.log(`✅ Initialized ${departments.length} corporate departments.`);

  // 3. Create Primary Super Administrator
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "AdminPassword123!";
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

  console.log(`✅ Created Master Super Administrator: ${superAdmin.displayName} (@${superAdmin.username})`);

  // 4. Create General Company Announcements Group
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

  // Welcome message from System Administrator
  await prisma.message.create({
    data: {
      conversationId: generalGroup.id,
      senderId: superAdmin.id,
      content: "Welcome to ConnectPro! 🎉 This private workspace is ready for enterprise communication. Company administrators can provision new employee accounts from the Admin Dashboard or Contacts directory.",
      type: "TEXT",
    },
  });

  // 5. Initial System Audit Log
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: "WORKSPACE_INITIALIZATION",
      details: "Initialized clean enterprise communication workspace with primary departments and Super Admin credentials.",
      ipAddress: "127.0.0.1",
    },
  });

  console.log("\n========================================================");
  console.log("   CLEAN PRODUCTION WORKSPACE INITIALIZATION COMPLETE   ");
  console.log("========================================================");
  console.log("  Super Admin Login: admin  (or admin@connectpro.internal)");
  console.log(`  Initial Password:  ${adminPassword}`);
  console.log("========================================================\n");
}

main()
  .catch((e) => {
    console.error("Initialization error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
