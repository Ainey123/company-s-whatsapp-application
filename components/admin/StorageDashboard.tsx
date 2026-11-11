"use client";

import React, { useState, useEffect } from "react";
import {
  HardDrive,
  Database,
  Cloud,
  FileText,
  Image as ImageIcon,
  Film,
  Mic,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Download,
  Trash2,
  RefreshCw,
  Save,
  Clock,
  CheckCircle,
  Eye,
  Star,
  Users,
  Building,
  BarChart3,
  Server,
  Layers,
} from "lucide-react";
import { formatFileSize } from "@/lib/utils";

export function StorageDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [policyForm, setPolicyForm] = useState<any>({
    temporaryFileDays: 7,
    voiceRetentionDays: 90,
    callLogRetentionDays: 180,
    groupFileRetentionDays: 365,
    storageQuotaBytes: 50 * 1024 * 1024 * 1024,
    warningThreshold: 70,
    criticalThreshold: 85,
    emergencyThreshold: 95,
    autoPurgeEnabled: false,
  });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySuccessMsg, setPolicySuccessMsg] = useState("");

  // Dry Run State
  const [dryRunData, setDryRunData] = useState<any>(null);
  const [runningDryRun, setRunningDryRun] = useState(false);

  // Execution Modal State
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [selectedPurgeCategory, setSelectedPurgeCategory] = useState<string>("all");
  const [purgeConfirmationText, setPurgeConfirmationText] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<any>(null);

  // Single File Deletion State
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/storage");
      const json = await res.json();
      if (res.ok) {
        setData(json);
        if (json.policy) {
          setPolicyForm({
            temporaryFileDays: json.policy.temporaryFileDays,
            voiceRetentionDays: json.policy.voiceRetentionDays,
            callLogRetentionDays: json.policy.callLogRetentionDays,
            groupFileRetentionDays: json.policy.groupFileRetentionDays,
            storageQuotaBytes: json.policy.storageQuotaBytes,
            warningThreshold: json.policy.warningThreshold,
            criticalThreshold: json.policy.criticalThreshold,
            emergencyThreshold: json.policy.emergencyThreshold,
            autoPurgeEnabled: json.policy.autoPurgeEnabled,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load storage overview:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPolicy(true);
    setPolicySuccessMsg("");
    try {
      const res = await fetch("/api/admin/retention/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      });
      if (res.ok) {
        setPolicySuccessMsg("Retention policy updated successfully.");
        loadStorageData();
        setTimeout(() => setPolicySuccessMsg(""), 4000);
      }
    } catch (err) {
      alert("Failed to update retention policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleRunDryRun = async () => {
    setRunningDryRun(true);
    setDryRunData(null);
    try {
      const res = await fetch("/api/admin/retention/dry-run");
      const json = await res.json();
      if (res.ok) {
        setDryRunData(json);
      }
    } catch (err) {
      alert("Failed to run retention analysis");
    } finally {
      setRunningDryRun(false);
    }
  };

  const handleExecutePurge = async () => {
    if (purgeConfirmationText !== "PURGE") {
      alert("Please type PURGE to confirm permanent deletion");
      return;
    }

    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await fetch("/api/admin/retention/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          category: selectedPurgeCategory,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setPurgeResult(json);
        loadStorageData();
        setDryRunData(null);
        setPurgeConfirmationText("");
      } else {
        alert(json.error || "Purge execution failed");
      }
    } catch (err) {
      alert("Error executing retention purge");
    } finally {
      setPurging(false);
    }
  };

  const handleDeleteSingleFile = async (messageId: string, isImportant: boolean) => {
    if (isImportant) {
      const ok = confirm("This file is marked Important. Are you absolutely sure you want to force delete it?");
      if (!ok) return;
    } else {
      const ok = confirm("Delete this file permanently from Cloudflare R2 / storage and free up space?");
      if (!ok) return;
    }

    setDeletingFileId(messageId);
    try {
      const res = await fetch(`/api/admin/storage/file/${messageId}${isImportant ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        loadStorageData();
      } else {
        alert(json.error || "Failed to delete file");
      }
    } catch (err) {
      alert("Failed to delete file");
    } finally {
      setDeletingFileId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
        <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Aggregating storage metrics across Neon DB & Cloudflare R2...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>Failed to load storage dashboard.</p>
        <button
          onClick={loadStorageData}
          className="mt-3 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { database, media, quota, largestFiles, usageByUser, usageByDepartment, recentAuditLogs } = data;
  const isDanger = quota.warningLevel === "DANGER_95";
  const isCritical = quota.warningLevel === "CRITICAL_85";
  const isWarning = quota.warningLevel === "WARNING_70";

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Warning Banners based on Thresholds (70%, 85%, 95%) */}
      {isDanger ? (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold">DANGER: Storage capacity exceeds 95% ({quota.usagePercentage}%)</h4>
            <p className="text-xs mt-1">
              ConnectPro storage is nearly full. Automatic or manual retention cleanup is urgently recommended to prevent message attachment delivery interruptions.
            </p>
          </div>
          <button
            onClick={() => setShowPurgeModal(true)}
            className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700"
          >
            Purge Now
          </button>
        </div>
      ) : isCritical ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold">CRITICAL WARNING: Storage at {quota.usagePercentage}% (exceeds 85% limit)</h4>
            <p className="text-xs mt-1">
              Your storage usage is elevated. Consider running a retention policy dry run or exporting old call logs and temporary files.
            </p>
          </div>
        </div>
      ) : isWarning ? (
        <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-800 dark:text-yellow-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold">Storage Advisory: Storage at {quota.usagePercentage}% (exceeds 70%)</h4>
            <p className="text-xs mt-1">
              Storage capacity has crossed 70%. Monitor your monthly upload volume and verify retention policies are active.
            </p>
          </div>
        </div>
      ) : null}

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Storage Quota Card */}
        <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Storage Quota</span>
            <div className={`p-2 rounded-xl ${isDanger ? "bg-red-100 text-red-600" : "bg-brand-50 text-brand-600 dark:bg-emerald-950/40 dark:text-emerald-400"}`}>
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{formatFileSize(quota.totalStorageBytes)}</div>
          <div className="mt-2">
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isDanger ? "bg-red-500" : isCritical ? "bg-amber-500" : "bg-brand-600"
                }`}
                style={{ width: `${Math.min(quota.usagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-neutral-500 mt-1">
              <span>{quota.usagePercentage}% used</span>
              <span>Limit: {(quota.quotaMB / 1024).toFixed(0)} GB</span>
            </div>
          </div>
        </div>

        {/* Media Storage */}
        <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Media Files (Object Storage)</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{formatFileSize(media.totalMediaBytes)}</div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-500">
            <span>{media.totalMediaFiles} total files</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              media.isR2Configured ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-neutral-100 text-neutral-600"
            }`}>
              {media.isR2Configured ? "Cloudflare R2" : "Local Storage"}
            </span>
          </div>
        </div>

        {/* Neon Database Storage */}
        <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Neon DB Metadata</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{formatFileSize(database.estimatedDbBytes)}</div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {database.totalMessages.toLocaleString()} msgs • {database.totalUsers} users • {database.totalCallLogs} calls
          </div>
        </div>

        {/* Security & Data Retention Safety */}
        <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Retention Safety Guard</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">Protected</div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Starred msgs & text history never auto-purged
          </div>
        </div>
      </div>

      {/* MEDIA BREAKDOWN & USAGE GRIDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media Breakdown by Type */}
        <div className="bg-white dark:bg-chat-darkPanel p-6 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            Media Storage Breakdown
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold block">Images & Photos</span>
                  <span className="text-[10px] text-neutral-500">{media.mediaByType.image.count} files (WebP optimized)</span>
                </div>
              </div>
              <span className="text-xs font-bold">{formatFileSize(media.mediaByType.image.bytes)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pink-100 dark:bg-pink-950/40 text-pink-600">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold block">Videos</span>
                  <span className="text-[10px] text-neutral-500">{media.mediaByType.video.count} files</span>
                </div>
              </div>
              <span className="text-xs font-bold">{formatFileSize(media.mediaByType.video.bytes)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold block">Voice Notes</span>
                  <span className="text-[10px] text-neutral-500">{media.mediaByType.voice.count} recordings</span>
                </div>
              </div>
              <span className="text-xs font-bold">{formatFileSize(media.mediaByType.voice.bytes)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold block">Documents & PDFs</span>
                  <span className="text-[10px] text-neutral-500">{media.mediaByType.document.count} files</span>
                </div>
              </div>
              <span className="text-xs font-bold">{formatFileSize(media.mediaByType.document.bytes)}</span>
            </div>
          </div>
        </div>

        {/* Usage by Department */}
        <div className="bg-white dark:bg-chat-darkPanel p-6 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-600" />
            Storage by Department
          </h3>
          {usageByDepartment.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">No department media uploads yet.</p>
          ) : (
            <div className="space-y-3">
              {usageByDepartment.map((item: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{item.department}</span>
                    <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                      {formatFileSize(item.bytes)} ({item.fileCount} files)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full rounded-full"
                      style={{
                        width: `${Math.min(
                          (item.bytes / (media.totalMediaBytes || 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Uploaders / Users */}
        <div className="bg-white dark:bg-chat-darkPanel p-6 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            Top Storage Consumers
          </h3>
          {usageByUser.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">No uploads recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {usageByUser.map((u: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold block">{u.userName}</span>
                    <span className="text-[10px] text-neutral-500">{u.department} • {u.fileCount} files</span>
                  </div>
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">{formatFileSize(u.bytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LARGEST FILES TABLE */}
      <div className="bg-white dark:bg-chat-darkPanel p-6 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-600" />
              Largest Files in Storage
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Review and safely remove individual high-consumption files. Reference checking prevents broken forwards.
            </p>
          </div>
          <button
            onClick={loadStorageData}
            className="p-1.5 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {largestFiles.length === 0 ? (
          <p className="text-xs text-neutral-500 py-6 text-center">No media files currently stored.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-chat-darkBorder text-neutral-500">
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Uploader</th>
                  <th className="py-2.5 px-3">Uploaded</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-chat-darkBorder">
                {largestFiles.map((file: any) => (
                  <tr key={file.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2 max-w-xs truncate">
                        {file.isImportant && (
                          <span title="Important file">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          </span>
                        )}
                        <span className="font-medium truncate">{file.fileName || "Unnamed file"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {file.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-neutral-700 dark:text-neutral-200">
                      {formatFileSize(file.fileSize || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                      {file.sender?.displayName}
                      <span className="text-[10px] block text-neutral-400">{file.sender?.department || "General"}</span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      {file.fileUrl && (
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex p-1.5 rounded-lg text-neutral-600 hover:text-brand-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          title="View / Download"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteSingleFile(file.id, file.isImportant)}
                        disabled={deletingFileId === file.id}
                        className="inline-flex p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Safely Delete File"
                      >
                        {deletingFileId === file.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AUTOMATIC RETENTION POLICIES CONFIGURATION & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Retention Policy Form */}
        <div className="bg-white dark:bg-chat-darkPanel p-6 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                Automatic Retention Policies
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Configure auto-cleanup lifetimes per data category.
              </p>
            </div>
            {policySuccessMsg && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {policySuccessMsg}
              </span>
            )}
          </div>

          <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                  Temporary Files Retention
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={policyForm.temporaryFileDays}
                    onChange={(e) => setPolicyForm({ ...policyForm, temporaryFileDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800"
                  />
                  <span className="text-neutral-500">Days</span>
                </div>
                <span className="text-[10px] text-neutral-400">Default: 7 days</span>
              </div>

              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                  Voice Messages Retention
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={730}
                    value={policyForm.voiceRetentionDays}
                    onChange={(e) => setPolicyForm({ ...policyForm, voiceRetentionDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800"
                  />
                  <span className="text-neutral-500">Days</span>
                </div>
                <span className="text-[10px] text-neutral-400">Default: 90 days</span>
              </div>

              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                  Call Logs Retention
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={730}
                    value={policyForm.callLogRetentionDays}
                    onChange={(e) => setPolicyForm({ ...policyForm, callLogRetentionDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800"
                  />
                  <span className="text-neutral-500">Days</span>
                </div>
                <span className="text-[10px] text-neutral-400">Default: 180 days</span>
              </div>

              <div>
                <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                  Group Files Retention
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1825}
                    value={policyForm.groupFileRetentionDays}
                    onChange={(e) => setPolicyForm({ ...policyForm, groupFileRetentionDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800"
                  />
                  <span className="text-neutral-500">Days</span>
                </div>
                <span className="text-[10px] text-neutral-400">Configurable lifetime</span>
              </div>
            </div>

            <div className="border-t border-neutral-100 dark:border-chat-darkBorder pt-3">
              <label className="block text-neutral-600 dark:text-neutral-400 font-medium mb-1">
                Company Storage Quota (Gigabytes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={Number((policyForm.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(0))}
                  onChange={(e) => setPolicyForm({ ...policyForm, storageQuotaBytes: Number(e.target.value) * 1024 * 1024 * 1024 })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800 font-semibold"
                />
                <span className="text-neutral-500 whitespace-nowrap">
                  GB
                </span>
              </div>
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div>
                <label className="text-[10px] text-neutral-500">Warning (70%)</label>
                <input
                  type="number"
                  value={policyForm.warningThreshold}
                  onChange={(e) => setPolicyForm({ ...policyForm, warningThreshold: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800 text-center font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500">Critical (85%)</label>
                <input
                  type="number"
                  value={policyForm.criticalThreshold}
                  onChange={(e) => setPolicyForm({ ...policyForm, criticalThreshold: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800 text-center font-bold text-amber-600"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500">Danger (95%)</label>
                <input
                  type="number"
                  value={policyForm.emergencyThreshold}
                  onChange={(e) => setPolicyForm({ ...policyForm, emergencyThreshold: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800 text-center font-bold text-red-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPolicy}
              className="w-full mt-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              {savingPolicy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Retention Policy
                </>
              )}
            </button>
          </form>
        </div>

        {/* Safety & Retention Execution Control */}
        <div className="bg-white dark:bg-chat-darkPanel p-6 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Safety & Retention Actions
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Safely analyze, export backup, and execute bulk retention cleanup with multi-level confirmation.
            </p>

            {/* Permanent Protections Info */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-chat-darkBorder mb-4 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Text Messages are never deleted
              </div>
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Starred / Important messages are strictly protected
              </div>
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Files referenced across multiple chats are preserved
              </div>
            </div>

            {/* Dry Run Result Box */}
            {dryRunData && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 mb-4 animate-in fade-in text-xs space-y-1.5">
                <div className="font-bold text-blue-900 dark:text-blue-200 flex justify-between">
                  <span>Dry Run Analysis:</span>
                  <span>{dryRunData.summary.totalPurgeableItems} items ({dryRunData.summary.totalPurgeableMB} MB)</span>
                </div>
                <div className="text-[11px] text-blue-800 dark:text-blue-300 grid grid-cols-2 gap-1 pt-1">
                  <span>• Temp files: {dryRunData.categories.temporaryFiles.count}</span>
                  <span>• Voice notes: {dryRunData.categories.voiceMessages.count}</span>
                  <span>• Group files: {dryRunData.categories.groupFiles.count}</span>
                  <span>• Call logs: {dryRunData.categories.callLogs.count}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRunDryRun}
                disabled={runningDryRun}
                className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                {runningDryRun ? (
                  <div className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                Analyze / Dry Run
              </button>

              <a
                href="/api/admin/retention/export"
                download
                className="py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Backup (JSON)
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowPurgeModal(true)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Execute Retention Purge
            </button>
          </div>
        </div>
      </div>

      {/* STORAGE AUDIT LOGS TABLE */}
      <div className="bg-white dark:bg-chat-darkPanel p-6 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-brand-600" />
          Storage & Retention Audit History
        </h3>
        {recentAuditLogs.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4 text-center">No purge or deletion operations recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-chat-darkBorder text-neutral-500">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Items Purged</th>
                  <th className="py-2 px-3">Freed Space</th>
                  <th className="py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-chat-darkBorder">
                {recentAuditLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                    <td className="py-2 px-3 text-neutral-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 dark:bg-neutral-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-3">{log.itemsPurged}</td>
                    <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatFileSize(Number(log.bytesFreed))}
                    </td>
                    <td className="py-2 px-3 text-neutral-400 truncate max-w-xs text-[11px]">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL FOR RETENTION PURGE */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-chat-darkPanel rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-chat-darkBorder space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 rounded-2xl bg-red-100 dark:bg-red-950/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Confirm Permanent Retention Purge
                </h3>
                <p className="text-xs text-neutral-500">
                  This action permanently removes expired objects from Cloudflare R2 / storage.
                </p>
              </div>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Select Scope:
              </label>
              <select
                value={selectedPurgeCategory}
                onChange={(e) => setSelectedPurgeCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-chat-darkBorder bg-neutral-50 dark:bg-neutral-800 text-xs font-medium"
              >
                <option value="all">All Expired Categories (Temp, Voice, Group, Call Logs)</option>
                <option value="temp">Temporary Files Only (Over {policyForm.temporaryFileDays} days)</option>
                <option value="voice">Voice Messages Only (Over {policyForm.voiceRetentionDays} days)</option>
                <option value="group">Group Files Only (Over {policyForm.groupFileRetentionDays} days)</option>
                <option value="callLogs">Call Logs Only (Over {policyForm.callLogRetentionDays} days)</option>
              </select>
            </div>

            {/* Safety reminders */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Protected Items:</p>
              <p>• All text messages are retained.</p>
              <p>• Starred / important messages will NOT be deleted.</p>
              <p>• If a file is shared in another chat, it will NOT be deleted.</p>
            </div>

            {/* Type PURGE Confirmation */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Type <span className="font-mono text-red-600 font-bold">PURGE</span> to proceed:
              </label>
              <input
                type="text"
                placeholder="PURGE"
                value={purgeConfirmationText}
                onChange={(e) => setPurgeConfirmationText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 text-xs font-mono font-bold"
              />
            </div>

            {purgeResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                {purgeResult.message}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeResult(null);
                  setPurgeConfirmationText("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-chat-darkBorder text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={purging || purgeConfirmationText !== "PURGE"}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {purging ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Purging...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Confirm & Purge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
