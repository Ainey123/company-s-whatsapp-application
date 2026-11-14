"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Phone,
  Radio,
  DollarSign,
  Lock,
  Check,
  X,
  Smartphone,
  Wifi,
  Database,
  Activity,
  Copy,
  Key,
  QrCode,
} from "lucide-react";

interface OnboardingAccount {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string | null;
  coexistenceEnabled: boolean;
  status: string;
  appVersionConfirmed: string | null;
  historySyncStatus: string;
  historySyncProgress: number;
  historyTriggeredAt: string | null;
  contactSyncStatus: string;
  lastWebhookAt: string | null;
  lastEchoAt: string | null;
  chatsCount: number;
  phoneHeartbeatDaysRemaining: number | null;
  isTestAccount: boolean;
  createdAt: string;
}

interface OnboardingDiagnostics {
  totalMessages: number;
  totalEchoes: number;
  totalHistorySynced: number;
  recentWebhooks: Array<{
    id: string;
    idempotencyKey: string;
    eventType: string;
    status: string;
    retryCount: number;
    waMessageId: string | null;
    createdAt: string;
  }>;
  envConfigured: {
    metaAppId: boolean;
    metaConfigId: boolean;
    metaAppSecret: boolean;
    webhookVerifyToken: boolean;
    tokenEncryptionKey: boolean;
  };
}

export function WhatsAppConnectionManager() {
  const [account, setAccount] = useState<OnboardingAccount | null>(null);
  const [diagnostics, setDiagnostics] = useState<OnboardingDiagnostics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectTab, setConnectTab] = useState<"direct" | "embedded" | "sandbox">("direct");

  // Direct Meta WABA / Cloud API Token Form State
  const [directWabaId, setDirectWabaId] = useState("");
  const [directPhoneNumberId, setDirectPhoneNumberId] = useState("");
  const [directAccessToken, setDirectAccessToken] = useState("");
  const [directDisplayPhone, setDirectDisplayPhone] = useState("");
  const [directVerifiedName, setDirectVerifiedName] = useState("");

  // Embedded Signup v4 Form State
  const [embeddedAppId, setEmbeddedAppId] = useState(
    process.env.NEXT_PUBLIC_META_APP_ID || ""
  );
  const [embeddedConfigId, setEmbeddedConfigId] = useState(
    process.env.NEXT_PUBLIC_META_CONFIG_ID || ""
  );
  const [embeddedAppSecret, setEmbeddedAppSecret] = useState("");
  const embeddedSessionRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectInput, setDisconnectInput] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookCallbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/whatsapp/webhook`
      : "https://company-s-whatsapp-application.vercel.app/api/whatsapp/webhook";

  const fetchStatus = useCallback(async () => {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/whatsapp/onboarding");
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to load WhatsApp connection status");
      } else {
        setAccount(data.account || null);
        setDiagnostics(data.diagnostics || null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error while fetching connection status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Listen for Meta Embedded Signup v4 postMessage session info (waba_id, phone_number_id)
  useEffect(() => {
    const handleMetaMessage = (event: MessageEvent) => {
      if (
        !event.origin.endsWith("facebook.com") &&
        !event.origin.endsWith("fbcdn.net")
      ) {
        return;
      }
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && data.type === "WA_EMBEDDED_SIGNUP") {
          if (data.data?.waba_id) {
            embeddedSessionRef.current.wabaId = String(data.data.waba_id);
          }
          if (data.data?.phone_number_id) {
            embeddedSessionRef.current.phoneNumberId = String(
              data.data.phone_number_id
            );
          }
        }
      } catch {
        // Ignore non-JSON postMessages
      }
    };
    window.addEventListener("message", handleMetaMessage);
    return () => window.removeEventListener("message", handleMetaMessage);
  }, []);

  const handleCopyWebhookUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(webhookCallbackUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  const handleHealthAndSync = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/whatsapp/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger_sync" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Sync check failed");
      } else {
        setSuccessMsg(
          "Health check & Coexistence sync verified via /api/whatsapp/onboarding."
        );
      }
      await fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to run health check");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnectDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directWabaId.trim() || !directPhoneNumberId.trim() || !directAccessToken.trim()) {
      setErrorMsg("Please enter your WABA ID, Phone Number ID, and Meta Access Token.");
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/whatsapp/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect_direct_token",
          wabaId: directWabaId.trim(),
          phoneNumberId: directPhoneNumberId.trim(),
          accessToken: directAccessToken.trim(),
          displayPhoneNumber: directDisplayPhone.trim(),
          verifiedName: directVerifiedName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to connect real WhatsApp account");
      } else {
        setShowConnectModal(false);
        setDirectAccessToken("");
        setSuccessMsg(
          `Connected real WhatsApp Business number (${data.displayPhoneNumber || directPhoneNumberId}) and triggered Coexistence sync!`
        );
        await fetchStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error connecting WhatsApp account");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLaunchEmbeddedSignup = async () => {
    const appId = embeddedAppId.trim();
    const configId = embeddedConfigId.trim();
    if (!appId || !configId) {
      setErrorMsg("Please enter both your Meta App ID and Embedded Signup Config ID.");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Dynamically load Facebook JS SDK if not already present
      await new Promise<void>((resolve, reject) => {
        if ((window as any).FB) {
          (window as any).FB.init({
            appId,
            autoLogAppEvents: true,
            xfbml: true,
            version: "v23.0",
          });
          resolve();
          return;
        }
        (window as any).fbAsyncInit = function () {
          (window as any).FB.init({
            appId,
            autoLogAppEvents: true,
            xfbml: true,
            version: "v23.0",
          });
          resolve();
        };
        const existingScript = document.getElementById("facebook-jssdk");
        if (!existingScript) {
          const js = document.createElement("script");
          js.id = "facebook-jssdk";
          js.src = "https://connect.facebook.net/en_US/sdk.js";
          js.async = true;
          js.defer = true;
          js.onerror = () => reject(new Error("Failed to load Meta Facebook JS SDK"));
          document.body.appendChild(js);
        }
      });

      embeddedSessionRef.current = {};

      (window as any).FB.login(
        async (response: any) => {
          const code = response?.authResponse?.code;
          if (!code) {
            setActionLoading(false);
            setErrorMsg(
              "Embedded Signup popup closed or did not return an authorization code."
            );
            return;
          }

          const wabaId = embeddedSessionRef.current.wabaId || directWabaId.trim();
          const phoneNumberId =
            embeddedSessionRef.current.phoneNumberId || directPhoneNumberId.trim();

          if (!wabaId || !phoneNumberId) {
            setActionLoading(false);
            setErrorMsg(
              "Received OAuth code from Meta, but WABA ID / Phone Number ID were not captured. Please fill WABA ID and Phone Number ID or use Direct Token Connection."
            );
            return;
          }

          try {
            const exRes = await fetch("/api/whatsapp/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "exchange_code",
                code,
                wabaId,
                phoneNumberId,
                appId,
                appSecret: embeddedAppSecret.trim() || undefined,
              }),
            });
            const exData = await exRes.json();
            if (!exRes.ok) {
              setErrorMsg(exData.error || "Failed to exchange Embedded Signup code");
            } else {
              setShowConnectModal(false);
              setSuccessMsg(
                `WhatsApp Coexistence onboarded for ${exData.displayPhoneNumber}! Physical phone + ConnectPro are now linked.`
              );
              await fetchStatus();
            }
          } catch (err: any) {
            setErrorMsg(err.message || "Error completing Embedded Signup");
          } finally {
            setActionLoading(false);
          }
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        }
      );
    } catch (err: any) {
      setActionLoading(false);
      setErrorMsg(err.message || "Failed to initialize Meta Embedded Signup popup");
    }
  };

  const handleConnectSandbox = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/whatsapp/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect_test_account" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to provision sandbox account");
      } else {
        setShowConnectModal(false);
        setSuccessMsg(
          "Sandbox Coexistence Test Account connected and sample customer threads initialized in database."
        );
        await fetchStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect sandbox account");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnectConfirm = async () => {
    if (disconnectInput.trim() !== "DISCONNECT") return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/whatsapp/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to disconnect WhatsApp account");
      } else {
        setShowDisconnectModal(false);
        setDisconnectInput("");
        setSuccessMsg("WhatsApp account marked as DISCONNECTED in ConnectPro.");
        await fetchStatus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to disconnect account");
    } finally {
      setActionLoading(false);
    }
  };

  const isConnected = account && account.status === "CONNECTED";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Live Backend Status Banner */}
      <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 shrink-0 text-[#00A884]" />
          <span>
            <strong>Live Database & API Connected:</strong> Status, webhook logs, and message counters below are queried directly from <code>/api/whatsapp/onboarding</code>.
            {account?.isTestAccount && (
              <strong className="ml-1 text-amber-700 dark:text-amber-300">
                (Currently running in Safe Sandbox Test Account mode — Click &quot;Switch / Connect Real WhatsApp&quot; anytime.)
              </strong>
            )}
          </span>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading || actionLoading}
          className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Banner / Status Overview */}
      <div className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 dark:border-chat-darkBorder pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366]/15 dark:bg-[#25D366]/20 flex items-center justify-center text-[#00A884]">
              <MessageSquare className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  WhatsApp Account Connection
                </h2>
                <span className="text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Official Meta Coexistence v23.0
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Pairs your company&apos;s physical WhatsApp Business phone with ConnectPro for multi-employee collaboration.
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {isConnected && (
              <button
                onClick={handleHealthAndSync}
                disabled={actionLoading}
                className="px-3.5 py-2 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin text-[#00A884]" : ""}`} />
                <span>{actionLoading ? "Syncing..." : "Trigger Sync / Health Check"}</span>
              </button>
            )}
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 text-xs font-bold bg-[#00A884] hover:bg-[#008f6f] text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isConnected ? "Switch / Connect Real WhatsApp" : "Connect Existing WhatsApp"}
              </span>
            </button>
            {isConnected && (
              <button
                onClick={() => setShowDisconnectModal(true)}
                className="px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Webhook Callback URL Box for Meta App Dashboard */}
        <div className="mt-4 p-3.5 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/80 dark:border-chat-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200 block">
              Meta Webhook Callback URL (Paste in Meta Developer Dashboard &rarr; WhatsApp &rarr; Configuration):
            </span>
            <code className="text-xs font-mono text-[#00A884] break-all">
              {webhookCallbackUrl}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopyWebhookUrl}
            className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors flex items-center gap-1.5 shrink-0"
          >
            {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedWebhook ? "Copied!" : "Copy Webhook URL"}</span>
          </button>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/70 dark:border-chat-darkBorder">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1.5">
              <span className="text-[11px] font-medium">Connection State</span>
              <Radio className="w-3.5 h-3.5 text-[#00A884]" />
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
                }`}
              />
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {loading
                  ? "Loading..."
                  : isConnected
                    ? account.isTestAccount
                      ? "Connected (Sandbox Test)"
                      : "Connected (Real Coexistence)"
                    : "Not Connected"}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">
              WABA: {account?.wabaId || "None"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/70 dark:border-chat-darkBorder">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1.5">
              <span className="text-[11px] font-medium">Business Number</span>
              <Phone className="w-3.5 h-3.5 text-[#00A884]" />
            </div>
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block">
              {account?.displayPhoneNumber || "No Number Linked"}
            </span>
            <p className="text-[10px] text-neutral-400 mt-1">
              {account?.verifiedName || "Awaiting Coexistence Pairing"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/70 dark:border-chat-darkBorder">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1.5">
              <span className="text-[11px] font-medium">14-Day Handset Heartbeat</span>
              <Smartphone className="w-3.5 h-3.5 text-[#00A884]" />
            </div>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block">
              {account
                ? `${account.phoneHeartbeatDaysRemaining ?? 14} days remaining`
                : "Standby"}
            </span>
            <p className="text-[10px] text-neutral-400 mt-1">
              Last Phone Echo:{" "}
              {account?.lastEchoAt
                ? new Date(account.lastEchoAt).toLocaleTimeString()
                : "None yet"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/70 dark:border-chat-darkBorder">
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1.5">
              <span className="text-[11px] font-medium">Synchronized Data</span>
              <Wifi className="w-3.5 h-3.5 text-[#00A884]" />
            </div>
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block">
              {account?.chatsCount ?? 0} Chats &bull; {diagnostics?.totalMessages ?? 0} Msgs
            </span>
            <p className="text-[10px] text-neutral-400 mt-1">
              Phone Echoes: {diagnostics?.totalEchoes ?? 0} &bull; History: {diagnostics?.totalHistorySynced ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Environment & Webhook Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-[#00A884]" />
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Meta Environment & Security Status
            </h4>
          </div>
          <ul className="text-xs space-y-2 text-neutral-600 dark:text-neutral-400">
            {[
              { key: "WHATSAPP_TOKEN_ENCRYPTION_KEY", ok: diagnostics?.envConfigured.tokenEncryptionKey },
              { key: "WHATSAPP_VERIFY_TOKEN", ok: diagnostics?.envConfigured.webhookVerifyToken },
              { key: "NEXT_PUBLIC_META_APP_ID", ok: diagnostics?.envConfigured.metaAppId },
              { key: "NEXT_PUBLIC_META_CONFIG_ID", ok: diagnostics?.envConfigured.metaConfigId },
              { key: "META_APP_SECRET", ok: diagnostics?.envConfigured.metaAppSecret },
            ].map((item) => (
              <li key={item.key} className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-chat-darkBorder last:border-0">
                <code className="text-[11px] font-mono">{item.key}</code>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.ok
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                  }`}
                >
                  {item.ok ? "Configured" : "Can Enter in Connect Modal"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[#00A884]" />
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Recent Webhook Event Log (Idempotency Store)
            </h4>
          </div>
          {diagnostics?.recentWebhooks && diagnostics.recentWebhooks.length > 0 ? (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {diagnostics.recentWebhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="text-[11px] flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/60 dark:border-chat-darkBorder"
                >
                  <div className="truncate pr-2">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      {wh.eventType}
                    </span>
                    <span className="text-neutral-400 ml-2 font-mono text-[10px]">
                      {wh.idempotencyKey}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {wh.status} {wh.retryCount > 0 ? `(retries: ${wh.retryCount})` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 py-6 text-center">
              No webhook events logged yet. Click &quot;Connect Existing WhatsApp&quot; above to link your real Meta account or initialize the Sandbox Test Account.
            </p>
          )}
        </div>
      </div>

      {/* Cost Monitor */}
      <div className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder p-6 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 dark:border-chat-darkBorder pb-4 mb-4">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#00A884]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Meta Per-Message Pricing Rules (Zero Per-Employee Seat Cost)
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Inbound customer messages, manual phone replies, and ConnectPro free-form replies inside the 24-hour customer service window are $0.00.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/70 dark:border-chat-darkBorder">
            <span className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
              Inbound & 24h Service Replies
            </span>
            <span className="text-emerald-600 font-bold text-sm">$0.00 (Free)</span>
            <p className="text-[11px] text-neutral-500 mt-1">
              All customer inquiries and employee replies sent within 24 hours of the customer&apos;s last message.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/70 dark:border-chat-darkBorder">
            <span className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
              Physical Phone Manual Replies
            </span>
            <span className="text-emerald-600 font-bold text-sm">$0.00 (Free)</span>
            <p className="text-[11px] text-neutral-500 mt-1">
              Messages sent directly from the physical WhatsApp Business phone echo into ConnectPro at zero cost.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-chat-darkIn border border-neutral-200/70 dark:border-chat-darkBorder">
            <span className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
              ConnectPro Employee Seats
            </span>
            <span className="text-emerald-600 font-bold text-sm">$0.00 / Unlimited</span>
            <p className="text-[11px] text-neutral-500 mt-1">
              Direct Meta Cloud API integration with no third-party BSP per-agent licensing fees.
            </p>
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-chat-darkPanel rounded-3xl border border-neutral-200 dark:border-chat-darkBorder shadow-2xl max-w-xl w-full p-6 sm:p-7 animate-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-chat-darkBorder pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 text-[#00A884] flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Connect WhatsApp Business to ConnectPro
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Connect your real Meta WhatsApp Business Account or test with Sandbox Mode
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Connection Mode Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl mb-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setConnectTab("direct")}
                className={`py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  connectTab === "direct"
                    ? "bg-white dark:bg-chat-darkPanel text-[#00A884] shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>1. Real Meta Token</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectTab("embedded")}
                className={`py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  connectTab === "embedded"
                    ? "bg-white dark:bg-chat-darkPanel text-[#00A884] shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>2. QR Embedded Signup</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectTab("sandbox")}
                className={`py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  connectTab === "sandbox"
                    ? "bg-white dark:bg-chat-darkPanel text-[#00A884] shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>3. Sandbox Demo</span>
              </button>
            </div>

            {/* TAB 1: Direct Real Meta WABA & Access Token Connection */}
            {connectTab === "direct" && (
              <form onSubmit={handleConnectDirect} className="space-y-3.5">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <strong>Fastest Real Connection:</strong> Open your{" "}
                  <strong>Meta Developer App &rarr; WhatsApp &rarr; API Setup</strong>, copy your{" "}
                  <strong>WhatsApp Business Account ID</strong>, <strong>Phone Number ID</strong>, and{" "}
                  <strong>Access Token</strong>, and paste them below.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      WhatsApp Business Account (WABA) ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={directWabaId}
                      onChange={(e) => setDirectWabaId(e.target.value)}
                      placeholder="e.g. 109283746510293"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Phone Number ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={directPhoneNumberId}
                      onChange={(e) => setDirectPhoneNumberId(e.target.value)}
                      placeholder="e.g. 102938475610293"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Meta Permanent / System User Access Token *
                  </label>
                  <input
                    type="password"
                    required
                    value={directAccessToken}
                    onChange={(e) => setDirectAccessToken(e.target.value)}
                    placeholder="EAAGm0PX4ZCpsBA..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Display Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={directDisplayPhone}
                      onChange={(e) => setDirectDisplayPhone(e.target.value)}
                      placeholder="e.g. +92 300 1234567"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Business Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={directVerifiedName}
                      onChange={(e) => setDirectVerifiedName(e.target.value)}
                      placeholder="e.g. ConnectPro Enterprise"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 text-xs font-bold bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {actionLoading
                      ? "Verifying with Meta Graph API..."
                      : "Verify & Connect Real WhatsApp Account"}
                  </span>
                </button>
              </form>
            )}

            {/* TAB 2: Official Meta Embedded Signup v4 (QR Code Coexistence Popup) */}
            {connectTab === "embedded" && (
              <div className="space-y-3.5">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Official Meta Embedded Signup v4 (QR Code Coexistence):</strong> Launches Meta&apos;s Facebook Login for Business popup with <code>featureType: &quot;whatsapp_business_app_onboarding&quot;</code> so you can scan the QR code from your physical WhatsApp Business phone (<strong>Linked Devices &rarr; Link a Device</strong>).
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Meta App ID *
                    </label>
                    <input
                      type="text"
                      value={embeddedAppId}
                      onChange={(e) => setEmbeddedAppId(e.target.value)}
                      placeholder="From Meta App Basic Settings"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Embedded Signup Config ID *
                    </label>
                    <input
                      type="text"
                      value={embeddedConfigId}
                      onChange={(e) => setEmbeddedConfigId(e.target.value)}
                      placeholder="From Facebook Login for Business"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn"
                    />
                  </div>
                </div>

                {!diagnostics?.envConfigured.metaAppSecret && (
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Meta App Secret (Required once if META_APP_SECRET is not set in Vercel)
                    </label>
                    <input
                      type="password"
                      value={embeddedAppSecret}
                      onChange={(e) => setEmbeddedAppSecret(e.target.value)}
                      placeholder="Meta App Secret for OAuth code exchange"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-chat-darkIn font-mono"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleLaunchEmbeddedSignup}
                  className="w-full py-2.5 text-xs font-bold bg-[#1877F2] hover:bg-[#166fe5] disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {actionLoading
                      ? "Waiting for Meta Embedded Signup..."
                      : "Launch Meta Embedded Signup v4 (Scan QR Code)"}
                  </span>
                </button>
              </div>
            )}

            {/* TAB 3: Sandbox Demo Mode */}
            {connectTab === "sandbox" && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                  Safe Sandbox Test Account (Immediate Multi-Employee Inbox Demo)
                </span>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Provisions a safe test <code>WhatsAppAccount</code> in the database and runs realistic customer inbound messages and a physical-phone echo through the webhook processor so you can immediately test assigning chats, replying, and adding notes in the Workspace without Meta credentials.
                </p>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConnectSandbox}
                  className="w-full py-2.5 text-xs font-bold bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {actionLoading
                      ? "Provisioning Sandbox..."
                      : "Initialize Sandbox Test Account & Sample Customer Chats"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disconnect Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-chat-darkPanel rounded-3xl border border-neutral-200 dark:border-chat-darkBorder shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold">Disconnect WhatsApp Account</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4 leading-relaxed">
              Disconnecting pauses ConnectPro webhook synchronizations. Your physical WhatsApp phone continues operating normally. Type <strong>DISCONNECT</strong> to confirm:
            </p>
            <input
              type="text"
              value={disconnectInput}
              onChange={(e) => setDisconnectInput(e.target.value)}
              placeholder="DISCONNECT"
              className="w-full px-3.5 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-300 dark:border-neutral-700 rounded-xl mb-4 text-center font-bold tracking-wider"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="flex-1 py-2 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                disabled={disconnectInput.trim() !== "DISCONNECT" || actionLoading}
                onClick={handleDisconnectConfirm}
                className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl transition-colors"
              >
                {actionLoading ? "Disconnecting..." : "Confirm Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
