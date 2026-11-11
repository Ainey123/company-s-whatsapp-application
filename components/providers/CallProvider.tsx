"use client";

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { useAuth, UserProfile } from "./AuthProvider";
import { useSocket } from "./SocketProvider";
import { soundManager } from "@/lib/sound";

export type CallType = "AUDIO" | "VIDEO";
export type CallStatus = "IDLE" | "CALLING" | "RINGING" | "CONNECTED" | "ENDED";

interface IncomingCallData {
  caller: {
    id: string;
    displayName: string;
    avatar: string | null;
    designation: string | null;
  };
  callType: CallType;
  offer: RTCSessionDescriptionInit;
}

interface CallContextType {
  callStatus: CallStatus;
  callType: CallType;
  remoteUser: {
    id: string;
    displayName: string;
    avatar: string | null;
  } | null;
  incomingCall: IncomingCallData | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  callDuration: number;
  startCall: (recipient: { id: string; displayName: string; avatar: string | null }, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [callStatus, setCallStatus] = useState<CallStatus>("IDLE");
  const [callType, setCallType] = useState<CallType>("VIDEO");
  const [remoteUser, setRemoteUser] = useState<{ id: string; displayName: string; avatar: string | null } | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<any>(null);
  const durationRef = useRef<number>(0);
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrack = useRef<MediaStreamTrack | null>(null);

  // Keep localStreamRef synced
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Call duration counter
  useEffect(() => {
    if (callStatus === "CONNECTED") {
      durationRef.current = 0;
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Clean streams and peer connection
  const cleanupCall = useCallback(() => {
    soundManager.stopRingtone();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (peerConnection.current) {
      peerConnection.current.onicecandidate = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setRemoteUser(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setCallStatus("IDLE");
  }, []);

  // Initialize RTCPeerConnection
  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("ice_candidate", {
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      peerConnection.current = pc;
      return pc;
    },
    [socket]
  );

  // Log call history to database
  const logCallRecord = async (
    callerId: string,
    receiverId: string,
    type: CallType,
    status: string,
    duration: number
  ) => {
    try {
      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId,
          receiverId,
          type,
          status,
          durationSec: duration,
        }),
      });
    } catch (e) {
      // Ignore
    }
  };

  // Socket event listeners for calling
  useEffect(() => {
    if (!socket || !user) return;

    // Incoming call received
    const handleIncomingCall = (data: IncomingCallData) => {
      if (callStatus !== "IDLE") {
        // Already busy in a call
        socket.emit("reject_call", { targetUserId: data.caller.id, reason: "busy" });
        return;
      }

      setIncomingCall(data);
      setCallType(data.callType);
      setRemoteUser(data.caller);
      setCallStatus("RINGING");
      soundManager.startRingtone();
    };

    // Caller receives acceptance
    const handleCallAnswered = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      soundManager.stopRingtone();
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus("CONNECTED");
      }
    };

    // ICE candidate from peer
    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        if (peerConnection.current && candidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.error("Error adding ice candidate", e);
      }
    };

    // Call rejected by peer
    const handleCallRejected = () => {
      soundManager.stopRingtone();
      soundManager.playCallEnded();
      if (remoteUser && user) {
        logCallRecord(user.id, remoteUser.id, callType, "REJECTED", 0);
      }
      cleanupCall();
    };

    // Call ended by peer
    const handleCallEnded = () => {
      soundManager.stopRingtone();
      soundManager.playCallEnded();
      if (remoteUser && user) {
        logCallRecord(user.id, remoteUser.id, callType, "COMPLETED", durationRef.current);
      }
      cleanupCall();
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_answered", handleCallAnswered);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_ended", handleCallEnded);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_answered", handleCallAnswered);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_ended", handleCallEnded);
    };
  }, [socket, user, callStatus, remoteUser, callType, cleanupCall]);

  // Start outgoing call
  const startCall = async (
    recipient: { id: string; displayName: string; avatar: string | null },
    type: CallType
  ) => {
    if (!socket || !user) return;

    try {
      setCallType(type);
      setRemoteUser(recipient);
      setCallStatus("CALLING");

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "VIDEO",
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection(recipient.id);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call_user", {
        recipientId: recipient.id,
        caller: {
          id: user.id,
          displayName: user.displayName,
          avatar: user.avatar,
          designation: user.designation,
        },
        callType: type,
        offer,
      });
    } catch (err) {
      console.error("Failed to start call", err);
      cleanupCall();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !socket || !user) return;

    soundManager.stopRingtone();

    try {
      const isVideo = incomingCall.callType === "VIDEO";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection(incomingCall.caller.id);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer_call", {
        targetUserId: incomingCall.caller.id,
        answer,
      });

      setCallStatus("CONNECTED");
      setIncomingCall(null);
    } catch (err) {
      console.error("Failed to accept call", err);
      cleanupCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall && socket) {
      socket.emit("reject_call", { targetUserId: incomingCall.caller.id, reason: "declined" });
      if (user) {
        logCallRecord(incomingCall.caller.id, user.id, incomingCall.callType, "REJECTED", 0);
      }
    }
    soundManager.stopRingtone();
    cleanupCall();
  };

  // End active call
  const endCall = () => {
    if (remoteUser && socket) {
      socket.emit("end_call", { targetUserId: remoteUser.id });
      if (user) {
        logCallRecord(user.id, remoteUser.id, callType, "COMPLETED", durationRef.current);
      }
    }
    soundManager.playCallEnded();
    cleanupCall();
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!peerConnection.current || !localStreamRef.current) return;

    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const senders = peerConnection.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");

        if (videoSender) {
          originalVideoTrack.current = videoSender.track;
          videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          if (originalVideoTrack.current && videoSender) {
            videoSender.replaceTrack(originalVideoTrack.current);
          }
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } else {
        const senders = peerConnection.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (originalVideoTrack.current && videoSender) {
          videoSender.replaceTrack(originalVideoTrack.current);
        }
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error("Screen sharing error:", err);
    }
  };

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callType,
        remoteUser,
        incomingCall,
        localStream,
        remoteStream,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        callDuration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
