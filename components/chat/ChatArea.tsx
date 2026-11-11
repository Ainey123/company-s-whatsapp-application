"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  Video,
  Info,
  Search,
  Paperclip,
  Smile,
  Mic,
  Send,
  X,
  Image as ImageIcon,
  FileText,
  Film,
  ChevronDown,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MessageBubble, MessageData } from "./MessageBubble";
import { EmojiPicker } from "./EmojiPicker";
import { VoiceRecorder } from "./VoiceRecorder";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSocket } from "@/components/providers/SocketProvider";
import { useCall } from "@/components/providers/CallProvider";
import { formatLastSeen } from "@/lib/utils";
import { soundManager } from "@/lib/sound";

interface ChatAreaProps {
  conversation: any;
  onToggleInfo: () => void;
  onForwardMessage: (msg: MessageData) => void;
}

export function ChatArea({ conversation, onToggleInfo, onForwardMessage }: ChatAreaProps) {
  const { user } = useAuth();
  const { socket, onlineUsers, typingUsers, sendTyping, stopTyping, notifyNewMessage } = useSocket();
  const { startCall } = useCall();

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileTypeRef = useRef<"IMAGE" | "VIDEO" | "DOCUMENT">("DOCUMENT");
  const typingTimeoutRef = useRef<any>(null);

  // Load messages for current conversation
  useEffect(() => {
    if (!conversation?.id) return;

    let isMounted = true;
    setLoading(true);

    fetch(`/api/conversations/${conversation.id}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.messages) {
          setMessages(data.messages);
        }
      })
      .catch((err) => console.error("Error loading messages:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Join room in socket
    if (socket) {
      socket.emit("join_conversation", conversation.id);
    }

    return () => {
      isMounted = false;
      if (socket) {
        socket.emit("leave_conversation", conversation.id);
      }
    };
  }, [conversation?.id, socket]);

  // Real-time socket message listeners
  useEffect(() => {
    if (!socket || !conversation?.id) return;

    const handleNewMessage = (msg: MessageData) => {
      if (msg.conversationId === conversation.id) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // Mark as read immediately if current active window
        if (user && msg.senderId !== user.id) {
          socket.emit("messages_read", {
            conversationId: conversation.id,
            readerId: user.id,
            messageIds: [msg.id],
          });
        }
      }
    };

    const handleMessageEdited = (edited: MessageData) => {
      if (edited.conversationId === conversation.id) {
        setMessages((prev) => prev.map((m) => (m.id === edited.id ? edited : m)));
      }
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: "This message was deleted" } : m))
      );
    };

    const handleReceiptUpdated = ({ readerId, messageIds }: { readerId: string; messageIds: string[] }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (messageIds.includes(m.id)) {
            const receipts = m.receipts || [];
            return {
              ...m,
              receipts: [...receipts.filter((r) => r.userId !== readerId), { userId: readerId, status: "READ" }],
            };
          }
          return m;
        })
      );
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("receipt_updated", handleReceiptUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("receipt_updated", handleReceiptUpdated);
    };
  }, [socket, conversation?.id, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (conversation?.id) {
      sendTyping(conversation.id);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(conversation.id);
      }, 2000);
    }
  };

  // Send text message or update edited message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !conversation?.id || !user) return;

    if (editingMessage) {
      // Edit message
      try {
        const res = await fetch(`/api/messages/${editingMessage.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: inputText }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)));
        }
      } catch (err) {
        console.error("Edit failed:", err);
      }
      setEditingMessage(null);
      setInputText("");
      return;
    }

    const payload = {
      content: inputText.trim(),
      type: "TEXT",
      replyToId: replyingTo?.id || null,
    };

    setInputText("");
    setReplyingTo(null);
    stopTyping(conversation.id);
    soundManager.playMessageSent();

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        notifyNewMessage(data.message);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Handle file uploads (Images, Videos, Documents)
  const triggerFileInput = (type: "IMAGE" | "VIDEO" | "DOCUMENT") => {
    fileTypeRef.current = type;
    setShowAttachMenu(false);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation?.id) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", fileTypeRef.current);

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();

      const msgPayload = {
        type: uploadData.type,
        fileUrl: uploadData.fileUrl,
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        content: "",
        replyToId: replyingTo?.id || null,
      };

      setReplyingTo(null);
      soundManager.playMessageSent();

      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgPayload),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        notifyNewMessage(data.message);
      }
    } catch (err) {
      alert("Failed to upload file. Please try again.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle recorded voice note
  const handleVoiceNoteReady = async (audioBlob: Blob, durationSec: number) => {
    setIsRecordingVoice(false);
    if (!conversation?.id) return;

    const formData = new FormData();
    formData.append("file", audioBlob, `voice-${Date.now()}.webm`);
    formData.append("type", "VOICE");

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Voice note upload failed");
      const uploadData = await uploadRes.json();

      const msgPayload = {
        type: "VOICE",
        fileUrl: uploadData.fileUrl,
        fileName: "Voice Note",
        fileSize: uploadData.fileSize,
        content: "",
        replyToId: replyingTo?.id || null,
      };

      soundManager.playMessageSent();

      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgPayload),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        notifyNewMessage(data.message);
      }
    } catch (err) {
      alert("Failed to send voice note.");
    }
  };

  // Calling handlers
  const handleStartAudioCall = () => {
    if (!conversation.isGroup && conversation.otherUser) {
      startCall(conversation.otherUser, "AUDIO");
    } else {
      alert("1-on-1 audio calling is enabled. Group calling is scheduled for the next release!");
    }
  };

  const handleStartVideoCall = () => {
    if (!conversation.isGroup && conversation.otherUser) {
      startCall(conversation.otherUser, "VIDEO");
    } else {
      alert("1-on-1 video calling is enabled. Group calling is scheduled for the next release!");
    }
  };

  // Other user online presence
  const isOtherOnline = !conversation.isGroup && conversation.otherUser ? onlineUsers.has(conversation.otherUser.id) : false;
  const typingInfo = typingUsers[conversation.id];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#EFEAE2] dark:bg-[#0C1317] relative select-none">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Header */}
      <div className="px-4 py-2.5 bg-neutral-50 dark:bg-chat-darkPanel border-b border-neutral-200 dark:border-chat-darkBorder flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onToggleInfo}>
          <Avatar
            src={conversation.avatar}
            name={conversation.name}
            size="sm"
            isOnline={!conversation.isGroup ? isOtherOnline : undefined}
          />
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
              {conversation.name}
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {conversation.isGroup
                ? `${conversation.members?.length || 0} members`
                : formatLastSeen(conversation.otherUser?.lastSeen, isOtherOnline)}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleStartAudioCall}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={handleStartVideoCall}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-neutral-200 dark:bg-chat-darkBorder mx-1" />

          <button
            onClick={onToggleInfo}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-brand-700 dark:hover:text-emerald-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Conversation Details"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area with WhatsApp Pattern */}
      <div className="flex-1 overflow-y-auto px-4 py-3 chat-pattern-light dark:chat-pattern-dark">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 dark:text-neutral-400">
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-emerald-950/40 text-brand-700 dark:text-emerald-400 flex items-center justify-center mb-3">
              <Avatar src={conversation.avatar} name={conversation.name} size="lg" />
            </div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">
              {conversation.name}
            </h3>
            <p className="text-xs max-w-xs mt-1 text-neutral-500 dark:text-neutral-400">
              This is the beginning of your private enterprise messaging history in ConnectPro.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMe={msg.senderId === user?.id}
                isGroup={conversation.isGroup}
                onReply={(m) => setReplyingTo(m)}
                onForward={onForwardMessage}
                onEdit={(m) => {
                  setEditingMessage(m);
                  setInputText(m.content);
                }}
                onDelete={async (id) => {
                  await fetch(`/api/messages/${id}`, { method: "DELETE" });
                }}
              />
            ))}

            {/* Live Typing indicator bar */}
            {typingInfo && (
              <div className="flex items-center gap-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 italic">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce delay-100" />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce delay-200" />
                </span>
                <span>{typingInfo.userName} is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Replying Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-neutral-100 dark:bg-chat-darkIn border-t border-neutral-200 dark:border-chat-darkBorder flex items-center justify-between animate-in fade-in slide-in-from-bottom-1">
          <div className="border-l-4 border-brand-600 pl-3 text-xs">
            <span className="font-semibold text-brand-700 dark:text-emerald-400">
              Replying to {replyingTo.sender?.displayName || "Message"}
            </span>
            <p className="truncate text-neutral-600 dark:text-neutral-300 max-w-md">
              {replyingTo.content || "Attachment"}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <span>Editing message</span>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText("");
            }}
            className="p-1 hover:bg-amber-200/60 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="p-3 bg-neutral-50 dark:bg-chat-darkPanel border-t border-neutral-200 dark:border-chat-darkBorder shrink-0">
        {isRecordingVoice ? (
          <VoiceRecorder
            onAudioReady={handleVoiceNoteReady}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative">
            {/* Emoji Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className="p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-full hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
                title="Emojis"
              >
                <Smile className="w-5 h-5" />
              </button>

              {showEmoji && (
                <EmojiPicker
                  onSelect={(emoji) => {
                    setInputText((prev) => prev + emoji);
                  }}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>

            {/* Attachment Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-full hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Attachment Popover */}
              {showAttachMenu && (
                <div className="absolute bottom-14 left-0 z-50 w-44 rounded-2xl bg-white dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder shadow-2xl p-1.5 text-xs font-medium animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => triggerFileInput("IMAGE")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors text-left"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-500" /> Photos & Images
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFileInput("VIDEO")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors text-left"
                  >
                    <Film className="w-4 h-4 text-pink-500" /> Videos
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFileInput("DOCUMENT")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-blue-500" /> Documents & PDFs
                  </button>
                </div>
              )}
            </div>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="flex-1 py-2 px-4 text-sm bg-white dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-2xl focus:outline-hidden focus:ring-1.5 focus:ring-brand-500 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 shadow-xs"
            />

            {/* Mic or Send button */}
            {inputText.trim().length > 0 ? (
              <button
                type="submit"
                className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-md transition-transform active:scale-95"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-md transition-transform active:scale-95"
                title="Record voice message"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
