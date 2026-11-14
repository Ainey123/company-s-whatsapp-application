"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  AlertTriangle,
  ChevronDown,
  Phone,
  CheckCheck,
  Check,
  StickyNote,
  UserCheck,
  RefreshCw,
  FileText,
  ExternalLink,
  History,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/providers/AuthProvider";

interface AssignedEmployee {
  id: string;
  username: string;
  displayName: string;
  avatar?: string | null;
  department?: string | null;
  role: string;
}

interface ServiceWindow {
  isOpen: boolean;
  expiresAt: string | null;
  remainingMinutes: number;
}

interface WhatsAppChatSummary {
  id: string;
  accountId: string;
  customerWaId: string;
  customerPhone: string;
  customerName: string | null;
  customerAvatar: string | null;
  assignedToUserId: string | null;
  assignedTo: AssignedEmployee | null;
  status: "OPEN" | "PENDING" | "RESOLVED";
  unreadCount: number;
  lastCustomerMsgAt: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageSource: string | null;
  version: number;
  serviceWindow: ServiceWindow;
  messagesCount: number;
  notesCount: number;
}

interface WhatsAppMessageItem {
  id: string;
  waMessageId: string;
  direction: "INBOUND" | "OUTBOUND";
  source: "CUSTOMER" | "CONNECTPRO" | "PHYSICAL_PHONE" | "HISTORY_SYNC";
  sentByUserId: string | null;
  sentBy: AssignedEmployee | null;
  type: string;
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  status: string;
  isEdited: boolean;
  isRevoked: boolean;
  waTimestamp: string;
}

interface WhatsAppNoteItem {
  id: string;
  content: string;
  createdAt: string;
  author: AssignedEmployee;
}

interface FullWhatsAppChat extends WhatsAppChatSummary {
  messages: WhatsAppMessageItem[];
  notes: WhatsAppNoteItem[];
}

export function WhatsAppMultiEmployeeInbox() {
  const { user } = useAuth();

  const [chats, setChats] = useState<WhatsAppChatSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<FullWhatsAppChat | null>(null);
  const [employees, setEmployees] = useState<AssignedEmployee[]>([]);

  const [filterQueue, setFilterQueue] = useState<"ALL" | "UNASSIGNED" | "MINE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [composerMode, setComposerMode] = useState<"REPLY" | "INTERNAL_NOTE">("REPLY");
  const [messageInput, setMessageInput] = useState("");
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load company employees for assignment dropdown
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setEmployees(data.users);
        }
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // Load chat list from /api/whatsapp/chats
  const fetchChatList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("queue", filterQueue);
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/whatsapp/chats?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Failed to load WhatsApp conversations");
      } else {
        const list: WhatsAppChatSummary[] = data.chats || [];
        setChats(list);
        if (list.length > 0 && (!selectedChatId || !list.some((c) => c.id === selectedChatId))) {
          setSelectedChatId(list[0].id);
        } else if (list.length === 0) {
          setSelectedChatId(null);
          setActiveChat(null);
        }
      }
    } catch (err: any) {
      setErrorBanner(err.message || "Network error loading WhatsApp inbox");
    } finally {
      setLoadingList(false);
    }
  }, [filterQueue, searchQuery, selectedChatId]);

  // Load full chat details (messages + internal notes)
  const fetchChatDetails = useCallback(async (chatId: string) => {
    setLoadingChat(true);
    try {
      const res = await fetch(`/api/whatsapp/chats/${chatId}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Failed to load conversation messages");
      } else {
        setActiveChat(data.chat || null);
        // Clear unread badge in sidebar list
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to load conversation");
    } finally {
      setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchChatList();
  }, [fetchChatList]);

  useEffect(() => {
    if (selectedChatId) {
      fetchChatDetails(selectedChatId);
    }
  }, [selectedChatId, fetchChatDetails]);

  const handleInitializeSandbox = async () => {
    setLoadingList(true);
    setErrorBanner(null);
    try {
      const res = await fetch("/api/whatsapp/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect_test_account" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Only Admins can initialize the Sandbox Test Account");
        setLoadingList(false);
        return;
      }
      await fetchChatList();
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to initialize sandbox data");
      setLoadingList(false);
    }
  };

  // Assign conversation via PATCH /api/whatsapp/chats/[id]
  const handleAssignConversation = async (assignedUserId: string | null) => {
    if (!activeChat) return;
    setShowAssignDropdown(false);
    setErrorBanner(null);

    try {
      const res = await fetch(`/api/whatsapp/chats/${activeChat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToUserId: assignedUserId,
          expectedVersion: activeChat.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Failed to update assignment");
        await fetchChatDetails(activeChat.id);
        return;
      }
      await fetchChatList();
      await fetchChatDetails(activeChat.id);
    } catch (err: any) {
      setErrorBanner(err.message || "Assignment error");
    }
  };

  // Cycle chat status (OPEN -> PENDING -> RESOLVED)
  const handleToggleStatus = async () => {
    if (!activeChat) return;
    const nextMap: Record<string, "OPEN" | "PENDING" | "RESOLVED"> = {
      OPEN: "PENDING",
      PENDING: "RESOLVED",
      RESOLVED: "OPEN",
    };
    const nextStatus = nextMap[activeChat.status] || "OPEN";
    setErrorBanner(null);

    try {
      const res = await fetch(`/api/whatsapp/chats/${activeChat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          expectedVersion: activeChat.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Failed to update status");
        await fetchChatDetails(activeChat.id);
        return;
      }
      await fetchChatList();
      await fetchChatDetails(activeChat.id);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to update status");
    }
  };

  // Send customer reply or internal note
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !messageInput.trim() || sending) return;

    setSending(true);
    setErrorBanner(null);

    try {
      if (composerMode === "INTERNAL_NOTE") {
        const res = await fetch(`/api/whatsapp/chats/${activeChat.id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageInput.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorBanner(data.error || "Failed to save internal note");
          return;
        }
      } else {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: activeChat.id,
            content: messageInput.trim(),
            type: "TEXT",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorBanner(data.error || "Failed to send WhatsApp reply");
          return;
        }
      }

      setMessageInput("");
      await fetchChatDetails(activeChat.id);
      await fetchChatList();
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // Upload media attachment and send via /api/whatsapp/send
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    setUploading(true);
    setErrorBanner(null);

    try {
      let mediaType = "DOCUMENT";
      if (file.type.startsWith("image/")) mediaType = "IMAGE";
      else if (file.type.startsWith("video/")) mediaType = "VIDEO";
      else if (file.type.startsWith("audio/")) mediaType = "VOICE";

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", mediaType);

      const upRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const upData = await upRes.json();
      if (!upRes.ok) {
        setErrorBanner(upData.error || "File upload failed");
        return;
      }

      const sendRes = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChat.id,
          content: file.name,
          type: mediaType,
          fileUrl: upData.fileUrl,
          fileKey: upData.fileKey,
          fileName: upData.fileName,
          fileSize: upData.fileSize,
          mimeType: upData.mimeType,
        }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        setErrorBanner(sendData.error || "Failed to send media attachment");
        return;
      }

      await fetchChatDetails(activeChat.id);
      await fetchChatList();
    } catch (err: any) {
      setErrorBanner(err.message || "Error uploading attachment");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Merge chronological timeline of messages and internal notes
  const combinedTimeline = React.useMemo(() => {
    if (!activeChat) return [];
    const msgItems = (activeChat.messages || []).map((m) => ({
      kind: "MESSAGE" as const,
      id: m.id,
      timestamp: new Date(m.waTimestamp).getTime(),
      msg: m,
    }));
    const noteItems = (activeChat.notes || []).map((n) => ({
      kind: "NOTE" as const,
      id: n.id,
      timestamp: new Date(n.createdAt).getTime(),
      note: n,
    }));
    return [...msgItems, ...noteItems].sort((a, b) => a.timestamp - b.timestamp);
  }, [activeChat]);

  const windowRemainingHours = activeChat?.serviceWindow?.remainingMinutes
    ? Math.max(0, Math.round((activeChat.serviceWindow.remainingMinutes / 60) * 10) / 10)
    : 0;

  return (
    <div className="flex h-full w-full bg-[#EFEAE2] dark:bg-[#0C1317] overflow-hidden select-none">
      {/* Left Sidebar: Shared Customer Queue */}
      <div className="w-80 md:w-96 flex flex-col bg-white dark:bg-chat-darkSidebar border-r border-neutral-200 dark:border-chat-darkBorder shrink-0">
        {/* Sidebar Header */}
        <div className="p-3.5 bg-neutral-50 dark:bg-chat-darkPanel border-b border-neutral-200 dark:border-chat-darkBorder">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center">
                <MessageSquare className="w-4 h-4 fill-current" />
              </div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                WhatsApp Shared Inbox
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchChatList();
                if (selectedChatId) fetchChatDetails(selectedChatId);
              }}
              className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
              title="Refresh Inbox"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin text-[#00A884]" : ""}`} />
            </button>
          </div>

          {/* Queue Filter Tabs */}
          <div className="grid grid-cols-3 p-1 bg-neutral-200/60 dark:bg-chat-darkIn rounded-xl text-[11px] font-bold mb-3">
            <button
              onClick={() => setFilterQueue("ALL")}
              className={`py-1.5 rounded-lg transition-all ${
                filterQueue === "ALL"
                  ? "bg-white dark:bg-neutral-800 text-[#00A884] shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterQueue("UNASSIGNED")}
              className={`py-1.5 rounded-lg transition-all ${
                filterQueue === "UNASSIGNED"
                  ? "bg-white dark:bg-neutral-800 text-[#00A884] shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
              }`}
            >
              Unassigned
            </button>
            <button
              onClick={() => setFilterQueue("MINE")}
              className={`py-1.5 rounded-lg transition-all ${
                filterQueue === "MINE"
                  ? "bg-white dark:bg-neutral-800 text-[#00A884] shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
              }`}
            >
              Assigned to Me
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer name or phone..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#00A884]"
            />
          </div>
        </div>

        {/* Customer Threads List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-chat-darkBorder">
          {loadingList ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              Loading WhatsApp conversations...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                No WhatsApp conversations in the <strong>{filterQueue}</strong> queue yet.
              </p>
              {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
                <button
                  type="button"
                  onClick={handleInitializeSandbox}
                  className="px-3.5 py-2 text-xs font-bold bg-[#00A884] hover:bg-[#008f6f] text-white rounded-xl shadow-xs transition-colors"
                >
                  Initialize Sandbox Test Chats
                </button>
              )}
            </div>
          ) : (
            chats.map((thread) => {
              const isSelected = thread.id === selectedChatId;
              const displayName = thread.customerName || thread.customerPhone;
              return (
                <div
                  key={thread.id}
                  onClick={() => setSelectedChatId(thread.id)}
                  className={`p-3.5 cursor-pointer transition-colors relative flex items-start gap-3 ${
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800/70"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  <Avatar
                    src={thread.customerAvatar || undefined}
                    name={displayName}
                    size="md"
                    isOnline={thread.serviceWindow?.isOpen}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {displayName}
                      </span>
                      <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                        {new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mb-1.5">
                      {thread.lastMessagePreview || "No messages yet"}
                    </p>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        {thread.assignedTo ? (
                          <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-200/70 dark:bg-neutral-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <UserCheck className="w-2.5 h-2.5 text-[#00A884]" />
                            <span>{thread.assignedTo.displayName.split(" ")[0]}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                            Unassigned
                          </span>
                        )}

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            thread.status === "OPEN"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                              : thread.status === "PENDING"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                                : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          {thread.status}
                        </span>
                      </div>

                      {thread.unreadCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#25D366] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Main Panel: Conversation View */}
      <div className="flex-1 flex flex-col h-full bg-[#EFEAE2] dark:bg-[#0C1317] relative">
        {errorBanner && (
          <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-[10px] font-bold underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#25D366]/15 text-[#00A884] flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              Select a WhatsApp Conversation
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mt-1">
              All incoming customer messages, physical phone echoes (<code>smb_message_echoes</code>), and employee replies synchronize here in real time.
            </p>
          </div>
        ) : (
          <>
            {/* Top Header */}
            <div className="px-4 py-2.5 bg-neutral-50 dark:bg-chat-darkPanel border-b border-neutral-200 dark:border-chat-darkBorder flex items-center justify-between shrink-0 shadow-xs z-10">
              <div className="flex items-center gap-3">
                <Avatar
                  src={activeChat.customerAvatar || undefined}
                  name={activeChat.customerName || activeChat.customerPhone}
                  size="sm"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                      {activeChat.customerName || activeChat.customerPhone}
                    </h3>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-mono">
                      {activeChat.customerPhone}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {activeChat.serviceWindow?.isOpen ? (
                      <>
                        24h Customer Service Window:{" "}
                        <strong className="text-emerald-600">
                          {windowRemainingHours}h remaining ($0.00 free replies)
                        </strong>
                      </>
                    ) : (
                      <span className="text-amber-600 font-semibold">
                        24h Window Closed — Requires Customer Message, Template, or Physical Phone Reply
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Assignment Dropdown & Status Toggle */}
              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[#00A884]" />
                    <span>
                      {activeChat.assignedTo
                        ? activeChat.assignedTo.displayName
                        : "Claim / Assign"}
                    </span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>

                  {showAssignDropdown && (
                    <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xl py-1.5 z-50">
                      <div className="px-3 py-1 border-b border-neutral-100 dark:border-chat-darkBorder text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Assign Conversation To
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAssignConversation(null)}
                        className="w-full px-3 py-2 text-left text-xs text-amber-600 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        Unassign (Return to Shared Queue)
                      </button>
                      {user && (
                        <button
                          type="button"
                          onClick={() => handleAssignConversation(user.id)}
                          className="w-full px-3 py-2 text-left text-xs font-bold text-[#00A884] hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between"
                        >
                          <span>Assign to Me ({user.displayName})</span>
                          <span className="text-[10px]">{user.role}</span>
                        </button>
                      )}
                      {employees
                        .filter((emp) => emp.id !== user?.id)
                        .map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => handleAssignConversation(emp.id)}
                            className="w-full px-3 py-2 text-left text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between"
                          >
                            <span className="truncate">{emp.displayName}</span>
                            <span className="text-[10px] text-neutral-400 ml-2">
                              {emp.department || emp.role}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-neutral-200 dark:border-chat-darkBorder bg-white dark:bg-chat-darkIn hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Status: {activeChat.status}
                </button>
              </div>
            </div>

            {/* Assignment Notice if Assigned to Another Employee */}
            {activeChat.assignedTo &&
              user &&
              activeChat.assignedTo.id !== user.id && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/80 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Assigned Agent Alert:</strong> This conversation is currently assigned to{" "}
                      <strong>{activeChat.assignedTo.displayName}</strong>. Coordinate via an Internal Note before replying.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    Version v{activeChat.version}
                  </span>
                </div>
              )}

            {/* Messages & Notes Scroll Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 chat-pattern-light dark:chat-pattern-dark">
              {loadingChat ? (
                <div className="text-center py-8 text-xs text-neutral-400">
                  Loading messages...
                </div>
              ) : combinedTimeline.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-400">
                  No messages in this conversation yet.
                </div>
              ) : (
                combinedTimeline.map((item) => {
                  if (item.kind === "NOTE") {
                    const note = item.note;
                    return (
                      <div key={`note_${note.id}`} className="flex justify-center my-2">
                        <div className="max-w-lg bg-amber-100/90 dark:bg-amber-950/80 border border-amber-300/80 dark:border-amber-700/80 rounded-2xl p-3 shadow-xs text-xs text-amber-900 dark:text-amber-200">
                          <div className="flex items-center gap-1.5 font-bold text-[10px] text-amber-800 dark:text-amber-300 mb-1">
                            <StickyNote className="w-3.5 h-3.5" />
                            <span>
                              INTERNAL STAFF NOTE • {note.author?.displayName || "Employee"}
                            </span>
                            <span className="ml-auto font-normal text-amber-600 dark:text-amber-400">
                              {new Date(note.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          <span className="text-[9px] text-amber-700 dark:text-amber-400 block mt-1 italic">
                            Private to ConnectPro employees; never visible to customer on WhatsApp.
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const msg = item.msg;
                  const isOutbound = msg.direction === "OUTBOUND";
                  const isEcho = msg.source === "PHYSICAL_PHONE";
                  const isHistory = msg.source === "HISTORY_SYNC";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-md rounded-2xl p-3 shadow-xs text-xs ${
                          isOutbound && !isEcho
                            ? "bg-[#D9FDD3] dark:bg-[#005C4B] text-neutral-900 dark:text-neutral-100 rounded-tr-none"
                            : isEcho
                              ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-neutral-900 dark:text-neutral-100 rounded-tr-none"
                              : "bg-white dark:bg-chat-darkPanel text-neutral-900 dark:text-neutral-100 rounded-tl-none border border-neutral-200/70 dark:border-chat-darkBorder"
                        }`}
                      >
                        {/* Origin Attribution */}
                        {isOutbound && !isEcho && (
                          <span className="text-[10px] font-bold text-[#00A884] block mb-1">
                            Sent via ConnectPro by{" "}
                            {msg.sentBy?.displayName || "Employee"}
                          </span>
                        )}
                        {isEcho && (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block mb-1 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" /> Sent from physical WhatsApp Business phone (Echo)
                          </span>
                        )}
                        {isHistory && (
                          <span className="text-[10px] font-semibold text-neutral-400 block mb-1 flex items-center gap-1">
                            <History className="w-2.5 h-2.5" /> Synced from 180-Day Phone History
                          </span>
                        )}

                        {/* Media Attachment Display */}
                        {msg.fileUrl && (
                          <div className="mb-2">
                            {msg.type === "IMAGE" ? (
                              <a
                                href={msg.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700"
                              >
                                <img
                                  src={msg.fileUrl}
                                  alt={msg.fileName || "WhatsApp image"}
                                  className="max-h-56 w-auto object-cover"
                                />
                              </a>
                            ) : msg.type === "VOICE" || msg.type === "AUDIO" ? (
                              <audio controls src={msg.fileUrl} className="max-w-full h-9" />
                            ) : (
                              <a
                                href={msg.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors"
                              >
                                <FileText className="w-4 h-4 text-[#00A884] shrink-0" />
                                <span className="truncate font-semibold underline">
                                  {msg.fileName || "Download Attachment"}
                                </span>
                                <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                              </a>
                            )}
                          </div>
                        )}

                        <p
                          className={`leading-relaxed whitespace-pre-wrap ${
                            msg.isRevoked ? "italic text-neutral-400 line-through" : ""
                          }`}
                        >
                          {msg.content}
                        </p>

                        <div className="flex items-center justify-end gap-1 text-[10px] text-neutral-400 mt-1">
                          {msg.isEdited && <span>(edited)</span>}
                          <span>
                            {new Date(msg.waTimestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isOutbound && (
                            <span title={`Status: ${msg.status}`}>
                              {msg.status === "READ" ? (
                                <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                              ) : msg.status === "DELIVERED" ? (
                                <CheckCheck className="w-3.5 h-3.5 text-neutral-400" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-neutral-400" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Composer & Mode Switcher */}
            <div className="p-3 bg-white dark:bg-chat-darkPanel border-t border-neutral-200 dark:border-chat-darkBorder shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setComposerMode("REPLY")}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                    composerMode === "REPLY"
                      ? "bg-[#00A884] text-white"
                      : "bg-neutral-100 dark:bg-chat-darkIn text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                  }`}
                >
                  <Send className="w-3 h-3" />
                  <span>Customer WhatsApp Reply</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("INTERNAL_NOTE")}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                    composerMode === "INTERNAL_NOTE"
                      ? "bg-amber-500 text-white"
                      : "bg-neutral-100 dark:bg-chat-darkIn text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
                  }`}
                >
                  <StickyNote className="w-3 h-3" />
                  <span>Internal Team Note (Private)</span>
                </button>
              </div>

              <form onSubmit={handleSendSubmit} className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {composerMode === "REPLY" && (
                  <button
                    type="button"
                    disabled={uploading || sending}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl bg-neutral-100 dark:bg-chat-darkIn hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
                    title="Attach Image, PDF Document, or Voice/Audio"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                )}

                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    composerMode === "REPLY"
                      ? `Reply to ${activeChat.customerName || activeChat.customerPhone} on WhatsApp...`
                      : "Add internal staff note (never sent to WhatsApp customer)..."
                  }
                  className={`flex-1 px-4 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    composerMode === "REPLY"
                      ? "bg-neutral-100 dark:bg-chat-darkIn border-neutral-200 dark:border-chat-darkBorder focus:ring-1.5 focus:ring-[#00A884]"
                      : "bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 focus:ring-1.5 focus:ring-amber-500"
                  }`}
                />
                <button
                  type="submit"
                  disabled={sending || uploading || !messageInput.trim()}
                  className={`p-2.5 rounded-xl text-white font-bold transition-all shadow-xs disabled:opacity-50 ${
                    composerMode === "REPLY"
                      ? "bg-[#00A884] hover:bg-[#008f6f]"
                      : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
