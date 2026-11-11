"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Users, User, Check, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/providers/AuthProvider";

interface NewChatModalProps {
  onClose: () => void;
  onConversationCreated: (conversation: any) => void;
}

export function NewChatModal({ onClose, onConversationCreated }: NewChatModalProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Group form state
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          // Exclude self from list
          setEmployees(data.users.filter((u: any) => u.id !== user?.id));
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filteredEmployees = employees.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      emp.displayName.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q) ||
      emp.designation?.toLowerCase().includes(q)
    );
  });

  // Start 1-on-1 direct chat
  const handleStartDirectChat = async (recipientId: string) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGroup: false, recipientId }),
      });

      if (res.ok) {
        const data = await res.json();
        onConversationCreated(data.conversation);
        onClose();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle user selection for group
  const toggleSelectUser = (id: string) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter((uid) => uid !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  };

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || creating) return;

    try {
      setCreating(true);
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isGroup: true,
          name: groupName.trim(),
          description: groupDesc.trim() || null,
          memberIds: selectedUserIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onConversationCreated(data.conversation);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-chat-darkBorder flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            {tab === "DIRECT" ? "New Direct Message" : "Create New Group"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-neutral-100 dark:border-chat-darkBorder text-xs font-semibold">
          <button
            onClick={() => setTab("DIRECT")}
            className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-2 transition-colors ${
              tab === "DIRECT"
                ? "border-brand-600 text-brand-700 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <User className="w-4 h-4" /> Direct Message
          </button>
          <button
            onClick={() => setTab("GROUP")}
            className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-2 transition-colors ${
              tab === "GROUP"
                ? "border-brand-600 text-brand-700 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Users className="w-4 h-4" /> Team Group
          </button>
        </div>

        {/* DIRECT CHAT VIEW */}
        {tab === "DIRECT" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-neutral-100 dark:border-chat-darkBorder">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by colleague name or department..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border-transparent rounded-xl focus:bg-white dark:focus:bg-chat-darkPanel focus:ring-1 focus:ring-brand-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-chat-darkBorder/40">
              {loading ? (
                <div className="p-8 text-center text-xs text-neutral-400">Loading directory...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">No colleagues found</div>
              ) : (
                filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => handleStartDirectChat(emp.id)}
                    className="p-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={emp.avatar} name={emp.displayName} size="sm" isOnline={emp.isOnline} />
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {emp.displayName}
                        </h4>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {emp.designation || "Colleague"} • {emp.department || "Enterprise"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-brand-600 font-semibold">Message</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* GROUP CREATION VIEW */}
        {tab === "GROUP" && (
          <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col min-h-0">
            <div className="p-4 space-y-3 border-b border-neutral-100 dark:border-chat-darkBorder">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Q4 Growth Sprint, Security Ops, Leadership..."
                  className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="What is this group about?"
                  className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="p-3 border-b border-neutral-100 dark:border-chat-darkBorder">
              <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                Select Members ({selectedUserIds.length} selected)
              </span>
            </div>

            {/* Selectable member list */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-chat-darkBorder/40">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedUserIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleSelectUser(emp.id)}
                    className="p-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={emp.avatar} name={emp.displayName} size="xs" />
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {emp.displayName}
                        </h4>
                        <p className="text-[10px] text-neutral-500">{emp.department}</p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submit Button */}
            <div className="p-3 border-t border-neutral-100 dark:border-chat-darkBorder bg-neutral-50 dark:bg-chat-darkIn">
              <button
                type="submit"
                disabled={!groupName.trim() || creating}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
              >
                {creating ? "Creating Group..." : "Create Team Group"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
