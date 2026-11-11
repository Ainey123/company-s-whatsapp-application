"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  UserPlus,
  MessageSquare,
  Phone,
  Video,
  ArrowLeft,
  Building,
  Mail,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSocket } from "@/components/providers/SocketProvider";
import { useCall } from "@/components/providers/CallProvider";
import { AddContactModal } from "@/components/contacts/AddContactModal";
import { NewGroupModal } from "@/components/chat/NewGroupModal";
import { formatLastSeen } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ContactsPage() {
  const { user, loading: authLoading } = useAuth();
  const { onlineUsers } = useSocket();
  const { startCall } = useCall();
  const router = useRouter();

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  // Start 1-on-1 private chat with contact
  const handleStartChat = async (contactId: string) => {
    if (contactId === user?.id) return;
    try {
      setStartingChatWith(contactId);
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGroup: false, recipientId: contactId }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/chat?c=${data.conversation.id}`);
      }
    } catch (err) {
      console.error("Error starting chat:", err);
    } finally {
      setStartingChatWith(null);
    }
  };

  // Quick call
  const handleStartCall = (contact: any, type: "AUDIO" | "VIDEO") => {
    startCall(
      {
        id: contact.id,
        displayName: contact.displayName,
        avatar: contact.avatar,
      },
      type
    );
  };

  // Filter contacts by search (name, username, phone, department) and department dropdown
  const filteredContacts = contacts.filter((c) => {
    if (selectedDept !== "ALL" && c.department !== selectedDept) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(q) ||
      c.username?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.department?.toLowerCase().includes(q) ||
      c.designation?.toLowerCase().includes(q)
    );
  });

  const departments = Array.from(
    new Set(contacts.map((c) => c.department).filter(Boolean))
  );

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#0C1317] text-neutral-900 dark:text-neutral-100 flex flex-col select-none antialiased">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-chat-darkPanel border-b border-neutral-200 dark:border-chat-darkBorder sticky top-0 z-30 px-4 sm:px-6 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Back to Conversations"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Chats</span>
            </Link>
            <div className="h-5 w-px bg-neutral-200 dark:bg-chat-darkBorder" />
            <div className="flex items-center gap-2">
              <div className="p-2 bg-brand-100 dark:bg-emerald-950/60 text-brand-700 dark:text-emerald-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                  Company Contacts
                </h1>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {contacts.length} registered colleagues in corporate directory
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 dark:bg-chat-darkIn hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
            >
              <Layers className="w-4 h-4 text-brand-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">New Group</span>
            </button>

            <button
              onClick={() => setShowAddContactModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Contact</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col">
        {/* Search & Department Filters Toolbar */}
        <div className="bg-white dark:bg-chat-darkPanel rounded-2xl p-4 border border-neutral-200 dark:border-chat-darkBorder shadow-2xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts by name, username, mobile number or department..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border-transparent rounded-xl focus:bg-white dark:focus:bg-chat-darkPanel focus:ring-1.5 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-2.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden font-medium"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contacts Grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white dark:bg-chat-darkPanel rounded-3xl border border-neutral-200 dark:border-chat-darkBorder p-8 text-center">
            <Users className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
            <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
              No contacts found
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mt-1 mb-4">
              Try adjusting your search criteria or add a new colleague contact.
            </p>
            <button
              onClick={() => setShowAddContactModal(true)}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
            >
              Add First Contact
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map((contact) => {
              const isMe = contact.id === user?.id;
              const isOnline = onlineUsers.has(contact.id);

              return (
                <div
                  key={contact.id}
                  className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200/90 dark:border-chat-darkBorder p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Avatar, Name, Role */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={contact.avatar}
                          name={contact.displayName}
                          size="lg"
                          isOnline={isOnline}
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                            {contact.displayName}
                            {isMe && (
                              <span className="text-[10px] text-brand-600 dark:text-emerald-400 font-semibold">
                                (You)
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-neutral-400 font-medium truncate">
                            @{contact.username}
                          </p>
                        </div>
                      </div>

                      <RoleBadge role={contact.role} />
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 py-2 border-t border-b border-neutral-100 dark:border-chat-darkBorder/60 my-2">
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span className="font-medium truncate">
                          {contact.designation || "Colleague"} • {contact.department || "Enterprise"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 truncate">
                          {contact.phone || "No phone registered"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="text-[11px] text-neutral-500 truncate">
                          {contact.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {formatLastSeen(contact.lastSeen, isOnline)}
                    </span>

                    {!isMe ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStartCall(contact, "AUDIO")}
                          className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                          title="Voice Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleStartCall(contact, "VIDEO")}
                          className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                          title="Video Call"
                        >
                          <Video className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleStartChat(contact.id)}
                          disabled={startingChatWith === contact.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-transform active:scale-95"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{startingChatWith === contact.id ? "Opening..." : "Chat"}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-neutral-400 italic">Current User Profile</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <AddContactModal
          onClose={() => setShowAddContactModal(false)}
          onContactCreated={(newContact) => {
            loadContacts();
          }}
        />
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <NewGroupModal
          onClose={() => setShowNewGroupModal(false)}
          onGroupCreated={(newGroup) => {
            router.push(`/chat?c=${newGroup.id}`);
          }}
        />
      )}
    </div>
  );
}
