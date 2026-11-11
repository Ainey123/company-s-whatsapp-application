"use client";

import React, { useState } from "react";
import { Smile, Briefcase, Heart, Flame, ThumbsUp, PartyPopper } from "lucide-react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: "Frequently Used",
    icon: Flame,
    emojis: ["👍", "❤️", "😊", "🎉", "🔥", "🚀", "👏", "✅", "🙌", "💯", "🙏", "💡"],
  },
  {
    name: "Faces & Emotions",
    icon: Smile,
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥹", "☺️", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😋", "😛", "😜", "🤪",
      "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕",
      "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😮‍💨", "😤", "😠",
      "😡", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😴", "🥱", "🤐"
    ],
  },
  {
    name: "Gestures & People",
    icon: ThumbsUp,
    emojis: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈",
      "👉", "👆", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "👏",
      "🤝", "🙌", "👐", "🤲", "🙏", "✍️", "💪", "🦾"
    ],
  },
  {
    name: "Office & Collaboration",
    icon: Briefcase,
    emojis: [
      "💼", "📁", "📂", "📄", "📊", "📈", "📉", "💻", "🖥️", "⌨️", "🖱️", "📱",
      "📞", "📧", "📨", "✉️", "📦", "📋", "📌", "📍", "📎", "📏", "🔒", "🔑",
      "🗓️", "📅", "⏳", "⌛", "⏰", "🔔", "📣", "📢"
    ],
  },
  {
    name: "Symbols & Celebrations",
    icon: PartyPopper,
    emojis: [
      "🎉", "🎊", "🥳", "🎯", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🌟", "⭐",
      "✨", "⚡", "💥", "🔥", "🚀", "💡", "💰", "💎", "❤️", "🧡", "💛", "💚",
      "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖"
    ],
  },
];

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");

  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji, index, self) => self.indexOf(emoji) === index)
    : EMOJI_CATEGORIES[activeTab].emojis;

  return (
    <div className="absolute bottom-16 left-4 z-50 w-80 rounded-2xl bg-white dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
      {/* Category Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-chat-darkBorder bg-neutral-50 dark:bg-chat-darkPanel px-2 py-1.5">
        {EMOJI_CATEGORIES.map((cat, i) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.name}
              onClick={() => {
                setActiveTab(i);
                setSearch("");
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                activeTab === i && !search
                  ? "bg-brand-100 dark:bg-emerald-950/60 text-brand-700 dark:text-emerald-400"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
              title={cat.name}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 max-h-60 overflow-y-auto grid grid-cols-8 gap-1.5 text-2xl">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={index}
            onClick={() => {
              onSelect(emoji);
            }}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
