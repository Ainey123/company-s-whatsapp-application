"use client";

import React from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useCall } from "@/components/providers/CallProvider";

export function IncomingCallDialog() {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === "VIDEO";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center text-center">
        {/* Pulsing Avatar */}
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-brand-500/30 animate-ping duration-1000" />
          <Avatar
            src={incomingCall.caller.avatar}
            name={incomingCall.caller.displayName}
            size="xl"
            className="relative"
          />
        </div>

        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
          {incomingCall.caller.displayName}
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          {incomingCall.caller.designation || "Colleague"}
        </p>

        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 dark:bg-emerald-950/60 text-brand-700 dark:text-emerald-400 text-xs font-semibold">
          {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
          Incoming {isVideo ? "Video" : "Voice"} Call...
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 mt-8 w-full">
          {/* Decline */}
          <button
            onClick={rejectCall}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 active:scale-95">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Decline</span>
          </button>

          {/* Accept */}
          <button
            onClick={acceptCall}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 active:scale-95">
              <Phone className="w-6 h-6" />
            </div>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
