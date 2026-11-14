"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSocket } from "@/components/providers/SocketProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatSidebar, ConversationItem } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { ChatInfoPanel } from "@/components/chat/ChatInfoPanel";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { NewGroupModal } from "@/components/chat/NewGroupModal";
import { ProfileModal } from "@/components/chat/ProfileModal";
import { ForwardModal } from "@/components/chat/ForwardModal";
import { VideoCallModal } from "@/components/call/VideoCallModal";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { MessageData } from "@/components/chat/MessageBubble";
import { WhatsAppMultiEmployeeInbox } from "@/components/chat/WhatsAppMultiEmployeeInbox";
import { MessageSquare, ShieldCheck, Lock, Users, Layers, ArrowLeft } from "lucide-react";
import Link from "next/link";

function ChatDashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"INTERNAL" | "WHATSAPP">("INTERNAL");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<MessageData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load conversations
  const loadConversations = async (autoSelectId?: string) => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const convList: ConversationItem[] = data.conversations || [];
        setConversations(convList);

        // Check target ID
        const targetId = autoSelectId || searchParams.get("c");
        if (targetId) {
          const match = convList.find((c) => c.id === targetId);
          if (match) {
            setActiveConversation(match);
          }
        } else if (!activeConversation && convList.length > 0) {
          setActiveConversation(convList[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, searchParams]);

  // Socket listener for new conversations and real-time updates
  useEffect(() => {
    if (!socket || !user) return;

    // When someone creates a group or 1-on-1 with current user
    const handleConversationCreated = (newConv: ConversationItem) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === newConv.id)) {
          return prev.map((c) => (c.id === newConv.id ? newConv : c));
        }
        return [newConv, ...prev];
      });
    };

    // When a group's name, description or avatar is changed
    const handleGroupInfoUpdated = ({
      conversationId,
      name,
      description,
      avatar,
    }: {
      conversationId: string;
      name?: string;
      description?: string;
      avatar?: string;
    }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              ...(name ? { name } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(avatar !== undefined ? { avatar } : {}),
            };
          }
          return c;
        })
      );

      setActiveConversation((prev) => {
        if (prev && prev.id === conversationId) {
          return {
            ...prev,
            ...(name ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(avatar !== undefined ? { avatar } : {}),
          };
        }
        return prev;
      });
    };

    // When any new message arrives, reorder sidebar and update snippet
    const handleNewMessage = (msg: any) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === msg.conversationId);
        if (index === -1) {
          // If conversation isn't in local list yet, reload all conversations
          loadConversations();
          return prev;
        }

        const target = { ...prev[index] };
        target.lastMessage = msg;
        target.lastMessageAt = msg.createdAt;

        // If not the active conversation, increment unread count for current user
        if (activeConversation?.id !== msg.conversationId && msg.senderId !== user.id) {
          target.unreadCount = (target.unreadCount || 0) + 1;
        }

        const rest = prev.filter((c) => c.id !== msg.conversationId);
        return [target, ...rest];
      });
    };

    socket.on("conversation_created", handleConversationCreated);
    socket.on("group_info_updated", handleGroupInfoUpdated);
    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("conversation_created", handleConversationCreated);
      socket.off("group_info_updated", handleGroupInfoUpdated);
      socket.off("new_message", handleNewMessage);
    };
  }, [socket, user, activeConversation?.id]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F0F2F5] dark:bg-[#0C1317]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-neutral-500">Connecting to ConnectPro...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F0F2F5] dark:bg-[#0C1317] antialiased">
      {/* Real-Time WebRTC Calling Overlays */}
      <IncomingCallDialog />
      <VideoCallModal />

      {/* Main Layout Container */}
      {activeChannel === "WHATSAPP" ? (
        <div className="flex flex-col w-full h-full">
          {/* Channel Return Bar */}
          <div className="px-4 py-2 bg-white dark:bg-chat-darkPanel border-b border-neutral-200 dark:border-chat-darkBorder flex items-center justify-between text-xs font-semibold shrink-0">
            <button
              onClick={() => setActiveChannel("INTERNAL")}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Internal Company Chats</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                Shared WhatsApp Inbox (MOCK DATA — Phase B preview, not connected)
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <WhatsAppMultiEmployeeInbox />
          </div>
        </div>
      ) : (
        <div className="flex w-full h-full">
          {/* Left Sidebar */}
          <div
            className={`${
              activeConversation ? "hidden md:flex" : "flex"
            } w-full md:w-96 shrink-0 h-full`}
          >
            <ChatSidebar
              conversations={conversations}
              activeConversationId={activeConversation?.id || null}
              onSelectConversation={(conv) => {
                setActiveConversation(conv);
              }}
              onOpenNewChat={() => setShowNewChatModal(true)}
              onOpenNewGroup={() => setShowNewGroupModal(true)}
              onOpenProfile={() => setShowProfileModal(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              channel={activeChannel}
              onChannelChange={setActiveChannel}
            />
          </div>

          {/* Middle Panel: Active Conversation or Empty Welcome Screen */}
          <div
            className={`${
              !activeConversation ? "hidden md:flex" : "flex"
            } flex-1 flex-col h-full min-w-0`}
          >
            {activeConversation ? (
              <ChatArea
                conversation={activeConversation}
                onToggleInfo={() => setShowInfoPanel(!showInfoPanel)}
                onForwardMessage={(msg) => setForwardingMessage(msg)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F0F2F5] dark:bg-[#0C1317] select-none">
                <div className="w-20 h-20 rounded-3xl bg-brand-100 dark:bg-emerald-950/40 text-brand-700 dark:text-emerald-400 flex items-center justify-center shadow-lg mb-4">
                  <MessageSquare className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
                  ConnectPro for Enterprise
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mb-6 leading-relaxed">
                  Seamless company messaging, group collaboration, voice notes and secure one-on-one audio/video calls without external dependencies.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setActiveChannel("WHATSAPP")}
                    className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-2xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 fill-current" />
                    Open WhatsApp Shared Inbox (+92)
                  </button>

                  <Link
                    href="/contacts"
                    className="px-4 py-2.5 bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder hover:border-brand-500 text-neutral-800 dark:text-neutral-200 rounded-2xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-2"
                  >
                    <Users className="w-4 h-4 text-brand-600" />
                    View All Contacts
                  </Link>

                  <button
                    onClick={() => setShowNewGroupModal(true)}
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold shadow-md transition-transform hover:scale-105 flex items-center gap-2 cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    Create New Group
                  </button>
                </div>

                <div className="mt-12 flex items-center gap-2 text-xs text-neutral-400">
                  <Lock className="w-3.5 h-3.5 text-brand-600" />
                  <span>Enterprise End-to-End Encrypted Communication</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Info Panel (Drawer) */}
          {showInfoPanel && activeConversation && (
            <div className="hidden lg:flex h-full shrink-0">
              <ChatInfoPanel
                conversationId={activeConversation.id}
                onClose={() => setShowInfoPanel(false)}
                onConversationUpdated={() => loadConversations(activeConversation.id)}
              />
            </div>
          )}
        </div>
      )}

      {/* Global Modals */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onConversationCreated={(newConv) => {
            setConversations((prev) => {
              if (prev.some((c) => c.id === newConv.id)) return prev;
              return [newConv, ...prev];
            });
            setActiveConversation(newConv);
            loadConversations(newConv.id);
          }}
        />
      )}

      {showNewGroupModal && (
        <NewGroupModal
          onClose={() => setShowNewGroupModal(false)}
          onGroupCreated={(newGroup) => {
            setConversations((prev) => {
              if (prev.some((c) => c.id === newGroup.id)) return prev;
              return [newGroup, ...prev];
            });
            setActiveConversation(newGroup);
            loadConversations(newGroup.id);
          }}
        />
      )}

      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}

      {forwardingMessage && (
        <ForwardModal
          message={forwardingMessage}
          conversations={conversations}
          onClose={() => setForwardingMessage(null)}
          onForwardSuccess={() => {
            if (activeConversation) loadConversations(activeConversation.id);
          }}
        />
      )}
    </div>
  );
}

export default function ChatDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#F0F2F5] dark:bg-[#0C1317]">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ChatDashboardContent />
    </Suspense>
  );
}
