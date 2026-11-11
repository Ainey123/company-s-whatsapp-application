"use client";

import React, { useState } from "react";
import { X, Search, Forward, Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MessageData } from "./MessageBubble";
import { soundManager } from "@/lib/sound";

interface ForwardModalProps {
  message: MessageData | null;
  conversations: any[];
  onClose: () => void;
  onForwardSuccess: () => void;
}

export function ForwardModal({
  message,
  conversations,
  onClose,
  onForwardSuccess,
}: ForwardModalProps) {
  const [search, setSearch] = useState("");
  const [forwarding, setForwarding] = useState<string | null>(null);

  if (!message) return null;

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleForwardTo = async (targetConversationId: string) => {
    try {
      setForwarding(targetConversationId);

      const payload = {
        content: message.content ? `Forwarded: ${message.content}` : "Forwarded message",
        type: message.type,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
      };

      const res = await fetch(`/api/conversations/${targetConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        soundManager.playMessageSent();
        onForwardSuccess();
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setForwarding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[75vh]">
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-chat-darkBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Forward className="w-5 h-5 text-brand-600" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Forward Message
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3 bg-neutral-50 dark:bg-chat-darkIn border-b border-neutral-100 dark:border-chat-darkBorder text-xs text-neutral-600 dark:text-neutral-300 truncate">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">Snippet: </span>
          {message.content || (message.type === "IMAGE" ? "📷 Image" : "Attachment")}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-neutral-100 dark:border-chat-darkBorder">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full px-3 py-1.5 text-xs bg-neutral-100 dark:bg-chat-darkIn border-transparent rounded-xl focus:outline-hidden"
          />
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-chat-darkBorder/40">
          {filtered.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleForwardTo(conv.id)}
              className="p-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Avatar src={conv.avatar} name={conv.name} size="xs" />
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  {conv.name}
                </span>
              </div>
              <button
                disabled={forwarding === conv.id}
                className="px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-emerald-950/60 text-brand-700 dark:text-emerald-400 text-xs font-semibold hover:bg-brand-200 transition-colors"
              >
                {forwarding === conv.id ? "Sending..." : "Send"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
