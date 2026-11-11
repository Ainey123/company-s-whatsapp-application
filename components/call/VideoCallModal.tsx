"use client";

import React, { useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  Maximize2,
  Volume2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useCall } from "@/components/providers/CallProvider";
import { formatDuration } from "@/lib/utils";

export function VideoCallModal() {
  const {
    callStatus,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    callDuration,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callStatus === "IDLE" || callStatus === "RINGING") return null;

  const isVideo = callType === "VIDEO";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 md:p-6 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border border-neutral-800">
        {/* Top Bar: Caller Info & Timer */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full">
            <Avatar src={remoteUser?.avatar} name={remoteUser?.displayName || "Colleague"} size="xs" />
            <div>
              <span className="text-xs font-semibold">{remoteUser?.displayName}</span>
              <p className="text-[10px] text-neutral-300">
                {callStatus === "CALLING" ? "Calling..." : formatDuration(callDuration)}
              </p>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-mono text-emerald-400 font-semibold">
            {callStatus === "CALLING" ? "Ringing..." : "Connected (P2P Encrypted)"}
          </div>
        </div>

        {/* Video Stage */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-neutral-950">
          {/* Remote Video / Avatar */}
          {isVideo && remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Avatar
                src={remoteUser?.avatar}
                name={remoteUser?.displayName || "Colleague"}
                size="xl"
                className="w-28 h-28 text-3xl mb-4 shadow-2xl"
              />
              <h2 className="text-xl font-bold text-white">{remoteUser?.displayName}</h2>
              <p className="text-sm text-neutral-400 mt-1">
                {callStatus === "CALLING" ? "Connecting to audio stream..." : "Voice Call Active"}
              </p>
            </div>
          )}

          {/* Local Video Picture-in-Picture (PIP) */}
          {isVideo && (
            <div className="absolute bottom-24 right-4 w-36 md:w-48 aspect-video bg-neutral-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-20">
              {isVideoOff ? (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-400 text-xs">
                  Camera Off
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-neutral-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-neutral-700/60 shadow-2xl">
          {/* Mute Mic */}
          <button
            onClick={toggleAudio}
            className={`p-3.5 rounded-full transition-colors ${
              isAudioMuted
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-neutral-800 text-white hover:bg-neutral-700"
            }`}
            title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Video (if video call) */}
          {isVideo && (
            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-full transition-colors ${
                isVideoOff
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-neutral-800 text-white hover:bg-neutral-700"
              }`}
              title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          {/* Toggle Screen Share */}
          {isVideo && (
            <button
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-full transition-colors ${
                isScreenSharing
                  ? "bg-brand-500 text-white"
                  : "bg-neutral-800 text-white hover:bg-neutral-700"
              }`}
              title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
            >
              <ScreenShare className="w-5 h-5" />
            </button>
          )}

          {/* End Call */}
          <button
            onClick={endCall}
            className="p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 ml-2"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
