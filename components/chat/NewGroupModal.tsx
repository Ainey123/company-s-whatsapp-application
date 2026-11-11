"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Users, Upload, Check, Camera, ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/providers/AuthProvider";

interface NewGroupModalProps {
  onClose: () => void;
  onGroupCreated: (newGroup: any) => void;
}

export function NewGroupModal({ onClose, onGroupCreated }: NewGroupModalProps) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Group Details
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all registered company employees
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          // Exclude self from the selectable members list
          setEmployees(data.users.filter((u: any) => u.id !== user?.id));
        }
      })
      .catch((err) => console.error("Failed to fetch employees:", err))
      .finally(() => setLoading(false));
  }, [user]);

  // Handle uploading group image
  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "IMAGE");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.fileUrl);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle user checkbox
  const toggleSelectUser = (id: string) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter((uid) => uid !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  };

  const removeSelectedMember = (id: string) => {
    setSelectedUserIds(selectedUserIds.filter((uid) => uid !== id));
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      emp.displayName.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q) ||
      emp.phone?.toLowerCase().includes(q)
    );
  });

  const selectedEmployees = employees.filter((emp) => selectedUserIds.includes(emp.id));

  // Submit group creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError("Please enter a group name.");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isGroup: true,
          name: groupName.trim(),
          description: groupDesc.trim() || null,
          avatar: avatarUrl || null,
          memberIds: selectedUserIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create group");
        setCreating(false);
        return;
      }

      onGroupCreated(data.conversation);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create group");
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-chat-darkBorder flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-100 dark:bg-emerald-950/60 text-brand-700 dark:text-emerald-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Create New Group
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Add team members and start collaborating
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col min-h-0">
          {error && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Group Details & Avatar */}
          <div className="p-6 border-b border-neutral-100 dark:border-chat-darkBorder space-y-4">
            <div className="flex items-center gap-4">
              {/* Group Avatar Upload */}
              <div className="relative group cursor-pointer">
                <Avatar
                  src={avatarUrl}
                  name={groupName || "Group"}
                  size="xl"
                  className="w-16 h-16"
                />
                <label className="absolute inset-0 rounded-full bg-black/40 hover:bg-black/60 flex flex-col items-center justify-center text-white cursor-pointer transition-colors opacity-90 group-hover:opacity-100">
                  <Camera className="w-5 h-5" />
                  <span className="text-[9px] font-medium mt-0.5">
                    {isUploading ? "..." : "Photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGroupAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Name & Description Inputs */}
              <div className="flex-1 space-y-2">
                <div>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group Subject / Name *"
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="Group description or purpose (optional)"
                    className="w-full px-3.5 py-1.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* Selected Members Preview Chips */}
            {selectedEmployees.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  Selected Members ({selectedEmployees.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-neutral-50 dark:bg-chat-darkIn/50 rounded-xl border border-neutral-100 dark:border-chat-darkBorder">
                  {selectedEmployees.map((emp) => (
                    <span
                      key={emp.id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder text-xs text-neutral-800 dark:text-neutral-200 shadow-2xs"
                    >
                      <Avatar src={emp.avatar} name={emp.displayName} size="xs" />
                      <span className="font-medium text-[11px]">{emp.displayName}</span>
                      <button
                        type="button"
                        onClick={() => removeSelectedMember(emp.id)}
                        className="text-neutral-400 hover:text-red-500 p-0.5 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search box for selecting members */}
          <div className="p-3 border-b border-neutral-100 dark:border-chat-darkBorder bg-neutral-50/60 dark:bg-chat-darkIn/40">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search colleagues by name, department or phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Employee list with checkboxes */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-chat-darkBorder/40">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-400">Loading registered colleagues...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">No colleagues found</div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedUserIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleSelectUser(emp.id)}
                    className="p-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={emp.avatar} name={emp.displayName} size="sm" isOnline={emp.isOnline} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                            {emp.displayName}
                          </h4>
                          <span className="text-[10px] text-neutral-400">@{emp.username}</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          {emp.designation || "Colleague"} • {emp.department} • {emp.phone}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                        isSelected
                          ? "bg-brand-600 border-brand-600 text-white shadow-xs"
                          : "border-neutral-300 dark:border-neutral-600 bg-white dark:bg-chat-darkPanel"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-neutral-100 dark:border-chat-darkBorder bg-neutral-50 dark:bg-chat-darkIn flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">
              {selectedUserIds.length + 1} total members (including you)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!groupName.trim() || creating}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                {creating ? "Creating..." : "Create Group"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
