"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  UserPlus,
  Shield,
  Trash2,
  BellOff,
  Bell,
  Pin,
  FileText,
  Mail,
  Phone,
  Briefcase,
  Building,
  LogOut,
  ImageIcon,
  Edit2,
  Camera,
  Check,
  Search,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badge";
import { formatFileSize, formatMessageTime } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";

interface ChatInfoPanelProps {
  conversationId: string;
  onClose: () => void;
  onConversationUpdated: () => void;
}

export function ChatInfoPanel({ conversationId, onClose, onConversationUpdated }: ChatInfoPanelProps) {
  const { user } = useAuth();
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"INFO" | "MEDIA" | "MEMBERS">("INFO");
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  // Group Edit State
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Member State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>("");

  useEffect(() => {
    fetchDetails();
    fetchEmployees();
  }, [conversationId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data.conversation);
        setEditName(data.conversation.name || "");
        setEditDesc(data.conversation.description || "");
        setEditAvatar(data.conversation.avatar || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAllEmployees(data.users || []);
      }
    } catch (e) {}
  };

  // Upload new group photo
  const handleUploadGroupPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "IMAGE");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setEditAvatar(data.fileUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Save Group Details
  const handleSaveGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      setSavingEdit(true);
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          avatar: editAvatar || null,
        }),
      });

      if (res.ok) {
        setIsEditingGroup(false);
        fetchDetails();
        onConversationUpdated();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleMute = async () => {
    if (!details) return;
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMuted: !details.isMuted }),
      });
      setDetails((prev: any) => ({ ...prev, isMuted: !prev.isMuted }));
      onConversationUpdated();
    } catch (e) {}
  };

  const togglePin = async () => {
    if (!details) return;
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !details.isPinned }),
      });
      setDetails((prev: any) => ({ ...prev, isPinned: !prev.isPinned }));
      onConversationUpdated();
    } catch (e) {}
  };

  const handleAddMember = async (userIdToAdd: string) => {
    if (!userIdToAdd) return;
    try {
      await fetch(`/api/conversations/${conversationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADD", userIds: [userIdToAdd] }),
      });
      setShowAddMemberModal(false);
      setSelectedUserToAdd("");
      fetchDetails();
      onConversationUpdated();
    } catch (e) {}
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm("Are you sure you want to remove this member from the group?")) return;
    try {
      await fetch(`/api/conversations/${conversationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVE", userId: targetUserId }),
      });
      fetchDetails();
      onConversationUpdated();
    } catch (e) {}
  };

  const handleToggleAdminRole = async (targetUserId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
    try {
      await fetch(`/api/conversations/${conversationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CHANGE_ROLE", userId: targetUserId, role: newRole }),
      });
      fetchDetails();
      onConversationUpdated();
    } catch (e) {}
  };

  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    try {
      await fetch(`/api/conversations/${conversationId}?action=leave`, { method: "DELETE" });
      onConversationUpdated();
      onClose();
    } catch (e) {}
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group and all its history for everyone?")) return;
    try {
      await fetch(`/api/conversations/${conversationId}?action=delete`, { method: "DELETE" });
      onConversationUpdated();
      onClose();
    } catch (e) {}
  };

  if (loading || !details) {
    return (
      <div className="w-80 border-l border-neutral-200 dark:border-chat-darkBorder bg-white dark:bg-chat-darkPanel flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isGroupAdmin = details.myRole === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const existingMemberIds = new Set(details.members?.map((m: any) => m.userId) || []);
  const availableToAdd = allEmployees.filter((emp) => !existingMemberIds.has(emp.id));

  const filteredAvailableToAdd = availableToAdd.filter((emp) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return (
      emp.displayName.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-80 md:w-88 border-l border-neutral-200 dark:border-chat-darkBorder bg-white dark:bg-chat-darkPanel flex flex-col h-full shadow-lg z-20 shrink-0 select-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-chat-darkBorder flex items-center justify-between">
        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
          {details.isGroup ? "Group Details" : "Contact Details"}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-chat-darkBorder text-xs font-semibold">
        <button
          onClick={() => setActiveTab("INFO")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
            activeTab === "INFO"
              ? "border-brand-600 text-brand-700 dark:text-emerald-400"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Overview
        </button>
        {details.isGroup && (
          <button
            onClick={() => setActiveTab("MEMBERS")}
            className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
              activeTab === "MEMBERS"
                ? "border-brand-600 text-brand-700 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Members ({details.members?.length || 0})
          </button>
        )}
        <button
          onClick={() => setActiveTab("MEDIA")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
            activeTab === "MEDIA"
              ? "border-brand-600 text-brand-700 dark:text-emerald-400"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Media ({details.sharedMedia?.length || 0})
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "INFO" && (
          <>
            {/* Edit Mode for Group */}
            {isEditingGroup && details.isGroup ? (
              <form onSubmit={handleSaveGroupEdit} className="p-3 bg-neutral-50 dark:bg-chat-darkIn rounded-2xl space-y-3">
                <div className="flex flex-col items-center">
                  <div className="relative group cursor-pointer">
                    <Avatar src={editAvatar} name={editName || "Group"} size="xl" className="w-16 h-16" />
                    <label className="absolute inset-0 rounded-full bg-black/40 hover:bg-black/60 flex flex-col items-center justify-center text-white cursor-pointer transition-colors opacity-90">
                      <Camera className="w-4 h-4" />
                      <span className="text-[8px] mt-0.5">{isUploadingPhoto ? "..." : "Change"}</span>
                      <input type="file" accept="image/*" onChange={handleUploadGroupPhoto} className="hidden" />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingGroup(false)}
                    className="px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-3.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            ) : (
              /* Normal View */
              <div className="flex flex-col items-center text-center pb-2 relative">
                {details.isGroup && isGroupAdmin && (
                  <button
                    onClick={() => setIsEditingGroup(true)}
                    className="absolute top-0 right-0 p-1.5 rounded-full bg-neutral-100 dark:bg-chat-darkIn hover:bg-neutral-200 text-neutral-600 dark:text-neutral-300"
                    title="Edit Group Info"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <Avatar src={details.avatar} name={details.name} size="xl" className="mb-3" />
                <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  {details.name}
                </h3>
                {details.otherUser && (
                  <div className="mt-1">
                    <RoleBadge role={details.otherUser.role || "EMPLOYEE"} />
                  </div>
                )}
                {details.description && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                    {details.description}
                  </p>
                )}
              </div>
            )}

            {/* Contact Information (for 1-on-1s) */}
            {details.otherUser && (
              <div className="p-3 bg-neutral-50 dark:bg-chat-darkIn rounded-xl space-y-2.5 text-xs">
                <div className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                  <Briefcase className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>{details.otherUser.designation || "Staff"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                  <Building className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>{details.otherUser.department || "Enterprise"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                  <Phone className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>{details.otherUser.phone || "No phone registered"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300">
                  <Mail className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="truncate">{details.otherUser.username}@connectpro.internal</span>
                </div>
              </div>
            )}

            {/* Preferences / Toggles */}
            <div className="space-y-1.5 pt-2">
              <button
                onClick={toggleMute}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200"
              >
                <span className="flex items-center gap-2">
                  {details.isMuted ? <BellOff className="w-4 h-4 text-amber-500" /> : <Bell className="w-4 h-4" />}
                  Mute Notifications
                </span>
                <span className="text-[11px] text-neutral-400 font-normal">
                  {details.isMuted ? "Muted" : "Off"}
                </span>
              </button>

              <button
                onClick={togglePin}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200"
              >
                <span className="flex items-center gap-2">
                  <Pin className="w-4 h-4 text-brand-600" /> Pin Chat to Top
                </span>
                <span className="text-[11px] text-neutral-400 font-normal">
                  {details.isPinned ? "Pinned" : "No"}
                </span>
              </button>
            </div>

            {/* Danger actions */}
            <div className="pt-4 border-t border-neutral-100 dark:border-chat-darkBorder space-y-1">
              {details.isGroup ? (
                <>
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Leave Group
                  </button>

                  {isGroupAdmin && (
                    <button
                      onClick={handleDeleteGroup}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Group for Everyone
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={handleLeaveGroup}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete Conversation
                </button>
              )}
            </div>
          </>
        )}

        {/* Group Members Tab */}
        {activeTab === "MEMBERS" && details.isGroup && (
          <div className="space-y-3">
            {/* Add Member trigger for Admins */}
            {isGroupAdmin && (
              <div className="p-3 bg-neutral-50 dark:bg-chat-darkIn rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Add New Members
                  </span>
                  <button
                    onClick={() => setShowAddMemberModal(!showAddMemberModal)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-brand-600 text-white rounded-lg text-xs font-semibold"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{showAddMemberModal ? "Close" : "Add Member"}</span>
                  </button>
                </div>

                {showAddMemberModal && (
                  <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-chat-darkBorder">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search available colleagues..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-lg focus:outline-hidden"
                    />

                    <div className="max-h-36 overflow-y-auto divide-y divide-neutral-100 dark:divide-chat-darkBorder">
                      {filteredAvailableToAdd.length === 0 ? (
                        <p className="text-[11px] text-neutral-400 py-2 text-center">
                          All colleagues are already in this group
                        </p>
                      ) : (
                        filteredAvailableToAdd.map((emp) => (
                          <div
                            key={emp.id}
                            className="py-1.5 px-1 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar src={emp.avatar} name={emp.displayName} size="xs" />
                              <div className="truncate">
                                <span className="text-xs font-medium block truncate">
                                  {emp.displayName}
                                </span>
                                <span className="text-[10px] text-neutral-400">
                                  {emp.department}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddMember(emp.id)}
                              className="px-2 py-1 bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-bold rounded-md"
                            >
                              Add
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Member list */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {details.members?.map((m: any) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={m.user.avatar} name={m.user.displayName} size="xs" />
                    <div className="truncate">
                      <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        {m.user.displayName} {m.userId === user?.id && "(You)"}
                      </p>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {m.user.designation || "Colleague"} • {m.user.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {m.role === "ADMIN" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-brand-100 dark:bg-emerald-950/60 text-brand-700 dark:text-emerald-400">
                        Admin
                      </span>
                    )}

                    {isGroupAdmin && m.userId !== user?.id && (
                      <>
                        <button
                          onClick={() => handleToggleAdminRole(m.userId, m.role)}
                          className="p-1 text-neutral-400 hover:text-brand-600"
                          title={m.role === "ADMIN" ? "Dismiss Admin" : "Make Group Admin"}
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          className="p-1 text-neutral-400 hover:text-red-600"
                          title="Remove from group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Media & Documents Tab */}
        {activeTab === "MEDIA" && (
          <div className="space-y-2">
            {details.sharedMedia?.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No media or files shared yet
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {details.sharedMedia?.map((m: any) => {
                  if (m.type === "IMAGE" && m.fileUrl) {
                    return (
                      <a
                        key={m.id}
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 hover:opacity-90 transition-opacity"
                      >
                        <img src={m.fileUrl} alt="media" className="w-full h-full object-cover" />
                      </a>
                    );
                  }
                  return (
                    <a
                      key={m.id}
                      href={m.fileUrl}
                      download
                      className="aspect-square rounded-lg p-2 bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder flex flex-col items-center justify-center text-center hover:bg-neutral-200/60 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-brand-600 mb-1" />
                      <span className="text-[9px] font-medium truncate w-full">
                        {m.fileName || "File"}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
