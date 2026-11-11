"use client";

import React, { useState } from "react";
import {
  MessageSquarePlus,
  Search,
  ShieldCheck,
  Pin,
  VolumeX,
  Users,
  User as UserIcon,
  LogOut,
  Moon,
  Sun,
  Layers,
  BookUser,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatChatListTime } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSocket } from "@/components/providers/SocketProvider";
import Link from "next/link";

export interface ConversationItem {
  id: string;
  isGroup: boolean;
  name: string;
  description?: string | null;
  avatar?: string | null;
  otherUser?: {
    id: string;
    displayName: string;
    username: string;
    phone?: string;
    avatar?: string | null;
    designation?: string | null;
    isOnline: boolean;
    lastSeen: string;
  } | null;
  members: any[];
  lastMessage?: {
    id: string;
    content: string;
    type: string;
    createdAt: string;
    senderId: string;
  } | null;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  myRole: string;
}

interface ChatSidebarProps {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (conv: ConversationItem) => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenProfile: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenProfile,
  searchQuery,
  onSearchChange,
}: ChatSidebarProps) {
  const { user, logout } = useAuth();
  const { onlineUsers, typingUsers } = useSocket();
  const [filterTab, setFilterTab] = useState<"ALL" | "DIRECT" | "GROUPS" | "UNREAD" | "PINNED">("ALL");
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchMsg = c.lastMessage?.content?.toLowerCase().includes(q);
      if (!matchName && !matchMsg) return false;
    }

    // Tabs
    if (filterTab === "DIRECT") return !c.isGroup;
    if (filterTab === "GROUPS") return c.isGroup;
    if (filterTab === "UNREAD") return c.unreadCount > 0;
    if (filterTab === "PINNED") return c.isPinned;
    return true;
  });

  const isAdminOrManager = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || user?.role === "MANAGER";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-chat-darkSidebar border-r border-neutral-200 dark:border-chat-darkBorder w-full md:w-96 select-none shrink-0">
      {/* Top Header */}
      <div className="px-4 py-3 bg-neutral-50 dark:bg-chat-darkPanel border-b border-neutral-200 dark:border-chat-darkBorder flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenProfile}
            className="focus:outline-hidden hover:opacity-85 transition-opacity"
            title="Profile & Settings"
          >
            <Avatar
              src={user?.avatar}
              name={user?.displayName || "Me"}
              size="sm"
              isOnline={true}
            />
          </button>
          <div>
            <h1 className="text-base font-bold text-brand-900 dark:text-emerald-400 leading-tight flex items-center gap-1.5">
              Connect<span className="text-brand-600 dark:text-emerald-300">Pro</span>
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
              {user?.department || "Enterprise"}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {/* Dedicated Contacts Navigation Link */}
          <Link
            href="/contacts"
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors relative"
            title="Contacts Directory"
          >
            <BookUser className="w-5 h-5" />
          </Link>

          {/* Dedicated New Group Button */}
          <button
            onClick={onOpenNewGroup}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Create New Group"
          >
            <Layers className="w-5 h-5" />
          </button>

          {/* New Chat Button */}
          <button
            onClick={onOpenNewChat}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Start Direct Message"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          {isAdminOrManager && (
            <Link
              href="/admin"
              className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
              title="Admin Dashboard"
            >
              <ShieldCheck className="w-5 h-5" />
            </Link>
          )}

          <button
            onClick={toggleDarkMode}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={logout}
            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Action Navigation Bar */}
      <div className="px-3 py-2 bg-neutral-100/60 dark:bg-chat-darkIn/60 border-b border-neutral-100 dark:border-chat-darkBorder flex items-center justify-between text-xs font-semibold">
        <Link
          href="/contacts"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-chat-darkPanel border border-neutral-200/80 dark:border-chat-darkBorder text-neutral-700 dark:text-neutral-200 hover:border-brand-500 transition-colors shadow-2xs"
        >
          <Users className="w-3.5 h-3.5 text-brand-600 dark:text-emerald-400" />
          <span>All Contacts</span>
        </Link>

        <button
          onClick={onOpenNewGroup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-emerald-950/40 border border-brand-200 dark:border-emerald-800 text-brand-700 dark:text-emerald-300 hover:bg-brand-100 transition-colors shadow-2xs"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>+ New Group</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 pt-2.5 pb-1.5 bg-white dark:bg-chat-darkSidebar">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search messages, people, groups..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border-transparent rounded-xl focus:bg-white dark:focus:bg-chat-darkPanel focus:ring-1 focus:ring-brand-500 focus:outline-hidden text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>
      </div>

      {/* Filter Tabs Chips */}
      <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-neutral-100 dark:border-chat-darkBorder/60 scrollbar-none">
        {(["ALL", "DIRECT", "GROUPS", "UNREAD", "PINNED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterTab === tab
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-neutral-100 dark:bg-chat-darkIn text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            }`}
          >
            {tab === "ALL" && "All"}
            {tab === "DIRECT" && "Direct"}
            {tab === "GROUPS" && "Groups"}
            {tab === "UNREAD" && "Unread"}
            {tab === "PINNED" && "Pinned"}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100/70 dark:divide-chat-darkBorder/40">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 dark:text-neutral-500 text-xs">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No conversations found</p>
            <div className="mt-3 flex justify-center gap-2">
              <Link
                href="/contacts"
                className="px-3 py-1 bg-brand-50 text-brand-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg font-semibold text-[11px]"
              >
                Browse Contacts
              </Link>
              <button
                onClick={onOpenNewGroup}
                className="px-3 py-1 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 rounded-lg font-semibold text-[11px]"
              >
                Create Group
              </button>
            </div>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = activeConversationId === conv.id;
            const typingInfo = typingUsers[conv.id];

            // Check if other user is online for 1-on-1s
            const isOnline = !conv.isGroup && conv.otherUser ? onlineUsers.has(conv.otherUser.id) : undefined;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors ${
                  isActive
                    ? "bg-emerald-50 dark:bg-neutral-800/80"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                }`}
              >
                {/* Avatar */}
                <Avatar
                  src={conv.avatar}
                  name={conv.name}
                  size="md"
                  isOnline={isOnline}
                />

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-sm truncate font-semibold flex items-center gap-1.5 ${
                        isActive
                          ? "text-brand-900 dark:text-emerald-300"
                          : "text-neutral-900 dark:text-neutral-100"
                      }`}
                    >
                      {conv.isGroup && <Layers className="w-3.5 h-3.5 text-brand-600 shrink-0" />}
                      <span className="truncate">{conv.name}</span>
                    </span>
                    <span className="text-[11px] text-neutral-400 shrink-0 ml-1">
                      {formatChatListTime(conv.lastMessage?.createdAt || conv.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    {/* Last message or typing indicator */}
                    <div className="truncate pr-2">
                      {typingInfo ? (
                        <span className="text-brand-600 dark:text-emerald-400 font-medium italic animate-pulse">
                          {typingInfo.userName} is typing...
                        </span>
                      ) : (
                        <span>
                          {conv.lastMessage?.type === "IMAGE" && "📷 Photo"}
                          {conv.lastMessage?.type === "VIDEO" && "🎥 Video"}
                          {conv.lastMessage?.type === "VOICE" && "🎤 Voice message"}
                          {conv.lastMessage?.type === "DOCUMENT" && "📄 Document"}
                          {(!conv.lastMessage || conv.lastMessage?.type === "TEXT") &&
                            (conv.lastMessage?.content || "No messages yet")}
                        </span>
                      )}
                    </div>

                    {/* Indicators: Pinned, Muted, Unread badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {conv.isMuted && <VolumeX className="w-3.5 h-3.5 text-neutral-400" />}
                      {conv.isPinned && <Pin className="w-3.5 h-3.5 text-neutral-400 fill-neutral-400" />}
                      {conv.unreadCount > 0 && (
                        <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
