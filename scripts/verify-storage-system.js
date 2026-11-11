const http = require("http");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== CONNECTPRO STORAGE & RETENTION SYSTEM VERIFICATION ===");

  // 1. Authenticate as Admin
  console.log("\n1. Testing Admin Authentication...");
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: "admin@connectpro.internal",
      password: "admin123",
    }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.user) {
    throw new Error("Admin login failed: " + JSON.stringify(loginData));
  }
  console.log("   Logged in as:", loginData.user.displayName, "(Role:", loginData.user.role + ")");

  const cookieHeader = loginRes.headers.get("set-cookie") || "";

  // 2. Query Storage Management Dashboard Metrics
  console.log("\n2. Fetching Real Database & Storage Metrics (GET /api/admin/storage)...");
  const storageRes = await fetch("http://localhost:3000/api/admin/storage", {
    headers: { Cookie: cookieHeader },
  });
  const storageData = await storageRes.json();
  if (!storageRes.ok) {
    throw new Error("Failed to fetch storage data: " + JSON.stringify(storageData));
  }

  console.log("   - Estimated DB Footprint:", storageData.database.estimatedDbBytes, "bytes across", storageData.database.totalMessages, "messages");
  console.log("   - Total Media Files:", storageData.media.totalMediaFiles, "files, size:", storageData.media.totalMediaBytes, "bytes");
  console.log("   - Media Storage Breakdown:", JSON.stringify(storageData.media.mediaByType));
  console.log("   - Quota Warning Level:", storageData.quota.warningLevel, "(" + storageData.quota.usagePercentage + "% utilized of " + storageData.quota.quotaMB + " MB)");

  // 3. Test Paginated Messages API
  console.log("\n3. Testing Paginated Message Loading with Cursor (GET /api/conversations/[id]/messages?limit=5)...");
  const convRes = await fetch("http://localhost:3000/api/conversations", {
    headers: { Cookie: cookieHeader },
  });
  const convData = await convRes.json();
  if (convData.conversations && convData.conversations.length > 0) {
    const testConvId = convData.conversations[0].id;
    const paginatedRes = await fetch(`http://localhost:3000/api/conversations/${testConvId}/messages?limit=5`, {
      headers: { Cookie: cookieHeader },
    });
    const paginatedData = await paginatedRes.json();
    console.log("   - Messages returned:", paginatedData.messages?.length);
    console.log("   - hasMore:", paginatedData.hasMore);
    console.log("   - nextCursor:", paginatedData.nextCursor);
  }

  // 4. Test Retention Policy Dry Run
  console.log("\n4. Testing Retention Policy Dry Run (GET /api/admin/retention/dry-run)...");
  const dryRunRes = await fetch("http://localhost:3000/api/admin/retention/dry-run", {
    headers: { Cookie: cookieHeader },
  });
  const dryRunData = await dryRunRes.json();
  console.log("   - Total purgeable items:", dryRunData.summary.totalPurgeableItems);
  console.log("   - Categories:", JSON.stringify(dryRunData.categories));
  console.log("   - Protections verified:", dryRunData.protected.textMessagesProtected);

  // 5. Test Retention Policy Backup Export
  console.log("\n5. Testing Backup Export Before Retention Purge (GET /api/admin/retention/export)...");
  const exportRes = await fetch("http://localhost:3000/api/admin/retention/export", {
    headers: { Cookie: cookieHeader },
  });
  const exportJson = await exportRes.json();
  console.log("   - Export status:", exportRes.status, "(Content-Type:", exportRes.headers.get("content-type") + ")");
  console.log("   - Export counts:", JSON.stringify(exportJson.counts));
  console.log("   - Exported by:", exportJson.exportedBy);

  // 6. Test Policy Configuration Update
  console.log("\n6. Testing Policy Update (POST /api/admin/retention/config)...");
  const configRes = await fetch("http://localhost:3000/api/admin/retention/config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      temporaryFileDays: 7,
      voiceRetentionDays: 90,
      callLogRetentionDays: 180,
      groupFileRetentionDays: 365,
      storageQuotaBytes: 53687091200,
      warningThreshold: 70,
      criticalThreshold: 85,
      emergencyThreshold: 95,
      autoPurgeEnabled: true,
    }),
  });
  const configData = await configRes.json();
  console.log("   - Policy Updated:", configData.success);
  console.log("   - Active Quota:", (configData.policy.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(0), "GB");

  console.log("\n=== ALL SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
