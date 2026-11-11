"use client";

import React, { useState, useRef } from "react";
import {
  Check,
  CheckCheck,
  FileText,
  Download,
  Play,
  Pause,
  Reply,
  Forward,
  Copy,
  Edit2,
  Trash2,
  MoreVertical,
  Volume2,
} from "lucide-react";
import { formatMessageTime, formatFileSize, formatDuration } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

export interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "VOICE";
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  replyToId?: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string | Date;
  sender?: {
    id: string;
    displayName: string;
    avatar?: string | null;
    designation?: string | null;
    role?: string;
  };
  replyTo?: {
    id: string;
    content: string;
    type: string;
    sender?: { displayName: string };
  } | null;
  receipts?: Array<{ userId: string; status: string; readAt?: string | null }>;
}

interface MessageBubbleProps {
  message: MessageData;
  isMe: boolean;
  isGroup: boolean;
  onReply: (message: MessageData) => void;
  onForward: (message: MessageData) => void;
  onEdit: (message: MessageData) => void;
  onDelete: (messageId: string) => void;
}

export function MessageBubble({
  message,
  isMe,
  isGroup,
  onReply,
  onForward,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Status ticks calculation
  const getReceiptStatus = () => {
    if (!isMe) return null;
    if (!message.receipts || message.receipts.length === 0) return "SENT";
    const hasRead = message.receipts.some((r) => r.status === "READ");
    if (hasRead) return "READ";
    const hasDelivered = message.receipts.some((r) => r.status === "DELIVERED");
    if (hasDelivered) return "DELIVERED";
    return "SENT";
  };

  const receiptStatus = getReceiptStatus();

  // Audio / Voice handler
  const handleToggleAudio = () => {
    if (!audioRef.current && message.fileUrl) {
      const audio = new Audio(message.fileUrl);
      audio.playbackRate = playbackRate;

      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setIsPlayingAudio(false);
        setAudioProgress(0);
      };

      audioRef.current = audio;
    }

    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().catch(() => {});
        setIsPlayingAudio(true);
      }
    }
  };

  const cyclePlaybackRate = () => {
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  // Deleted message state
  if (message.isDeleted) {
    return (
      <div className={`flex w-full my-1 ${isMe ? "justify-end" : "justify-start"}`}>
        <div className="max-w-md px-3.5 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/50 text-neutral-400 dark:text-neutral-500 text-xs italic flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" />
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex w-full my-1.5 ${
        isMe ? "justify-end" : "justify-start"
      }`}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className={`flex max-w-[85%] md:max-w-[70%] gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
        {/* In group chats, show sender avatar for others */}
        {!isMe && isGroup && (
          <Avatar
            src={message.sender?.avatar}
            name={message.sender?.displayName || "User"}
            size="xs"
            className="mt-1"
          />
        )}

        <div
          className={`relative rounded-2xl px-3.5 py-2 shadow-sm text-sm transition-all ${
            isMe
              ? "bg-[#D9FDD3] dark:bg-[#005C4B] text-neutral-900 dark:text-neutral-100 rounded-tr-xs"
              : "bg-white dark:bg-[#202C33] text-neutral-900 dark:text-neutral-100 rounded-tl-xs border border-neutral-100 dark:border-transparent"
          }`}
        >
          {/* Group Sender Name */}
          {!isMe && isGroup && (
            <div className="text-xs font-semibold text-brand-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
              <span>{message.sender?.displayName || "Colleague"}</span>
              {message.sender?.designation && (
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-normal">
                  • {message.sender.designation}
                </span>
              )}
            </div>
          )}

          {/* Quoted Reply Banner */}
          {message.replyTo && (
            <div
              className={`mb-2 pl-2.5 py-1 text-xs border-l-4 rounded-r-md bg-black/5 dark:bg-white/5 cursor-pointer ${
                isMe ? "border-brand-600" : "border-brand-500"
              }`}
            >
              <div className="font-semibold text-brand-800 dark:text-emerald-300">
                {message.replyTo.sender?.displayName || "Message"}
              </div>
              <div className="truncate text-neutral-600 dark:text-neutral-300">
                {message.replyTo.content || (message.replyTo.type === "IMAGE" ? "📷 Image" : "Attachment")}
              </div>
            </div>
          )}

          {/* Content Rendering based on Type */}

          {/* 1. IMAGE */}
          {message.type === "IMAGE" && message.fileUrl && (
            <div className="mb-1 rounded-xl overflow-hidden max-w-sm">
              <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={message.fileUrl}
                  alt={message.fileName || "Image"}
                  className="w-full max-h-72 object-cover rounded-xl hover:opacity-95 transition-opacity"
                />
              </a>
              {message.fileName && (
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                  {message.fileName}
                </div>
              )}
            </div>
          )}

          {/* 2. VIDEO */}
          {message.type === "VIDEO" && message.fileUrl && (
            <div className="mb-1 rounded-xl overflow-hidden max-w-sm">
              <video
                src={message.fileUrl}
                controls
                className="w-full max-h-72 rounded-xl bg-black"
              />
            </div>
          )}

          {/* 3. VOICE / AUDIO */}
          {(message.type === "VOICE" || message.type === "AUDIO") && message.fileUrl && (
            <div className="flex items-center gap-2.5 my-1 min-w-[240px]">
              <button
                type="button"
                onClick={handleToggleAudio}
                className="p-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-transform active:scale-95"
              >
                {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Waveform / Progress Slider */}
              <div className="flex-1 flex flex-col gap-1">
                <div className="w-full bg-neutral-300 dark:bg-neutral-600 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-brand-600 dark:bg-emerald-400 h-full transition-all duration-100"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Voice Note
                  </span>
                  <span>{formatDuration(Math.round(audioDuration || 0))}</span>
                </div>
              </div>

              {/* Speed multiplier pill */}
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                title="Playback speed"
              >
                {playbackRate}x
              </button>
            </div>
          )}

          {/* 4. DOCUMENT */}
          {message.type === "DOCUMENT" && message.fileUrl && (
            <div className="flex items-center gap-3 p-2.5 mb-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 max-w-sm">
              <div className="p-2 rounded-lg bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-neutral-900 dark:text-neutral-100">
                  {message.fileName || "Document file"}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  {message.fileSize ? formatFileSize(message.fileSize) : "Attachment"}
                </p>
              </div>
              <a
                href={message.fileUrl}
                download={message.fileName || "file"}
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                title="Download file"
              >
                <Download className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              </a>
            </div>
          )}

          {/* TEXT CONTENT */}
          {message.content && (
            <p className="whitespace-pre-wrap break-words leading-relaxed select-text">
              {message.content}
            </p>
          )}

          {/* Bottom Timestamp, Edited tag & Status ticks */}
          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-neutral-500 dark:text-neutral-400 select-none">
            {message.isEdited && <span className="italic mr-0.5">edited</span>}
            <span>{formatMessageTime(message.createdAt)}</span>

            {/* WhatsApp Double Blue Ticks */}
            {isMe && (
              <span className="ml-0.5 inline-flex items-center">
                {receiptStatus === "READ" ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                ) : receiptStatus === "DELIVERED" ? (
                  <CheckCheck className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                )}
              </span>
            )}
          </div>

          {/* Context Action Menu Trigger */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 text-neutral-600 dark:text-neutral-300 transition-opacity"
            title="Message actions"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {/* Action Popover Menu */}
          {showMenu && (
            <div className="absolute right-0 top-7 z-50 w-36 py-1 rounded-xl bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder shadow-xl text-xs font-medium animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  onReply(message);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-left"
              >
                <Reply className="w-3.5 h-3.5" /> Reply
              </button>
              <button
                onClick={() => {
                  onForward(message);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-left"
              >
                <Forward className="w-3.5 h-3.5" /> Forward
              </button>
              {message.content && (
                <button
                  onClick={copyText}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-left"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Text
                </button>
              )}
              {isMe && message.type === "TEXT" && (
                <button
                  onClick={() => {
                    onEdit(message);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-left"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              <div className="border-t border-neutral-100 dark:border-chat-darkBorder my-1" />
              <button
                onClick={() => {
                  onDelete(message.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-left"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
