"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useAuth } from "./AuthProvider";
import { soundManager } from "@/lib/sound";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Record<string, { userId: string; userName: string }>; // conversationId -> typing info
  sendTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  notifyNewMessage: (message: any) => void;
  notifyMessageRead: (conversationId: string, messageIds: string[]) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; userName: string }>>({});

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const s = getSocket(user.id);

    if (!s.connected) {
      s.connect();
    }

    const handleConnect = () => {
      setIsConnected(true);
      setOnlineUsers((prev) => new Set(prev).add(user.id));
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleStatusChanged = ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    };

    const handleUserTyping = ({
      conversationId,
      userId,
      userName,
    }: {
      conversationId: string;
      userId: string;
      userName: string;
    }) => {
      if (userId !== user.id) {
        setTypingUsers((prev) => ({
          ...prev,
          [conversationId]: { userId, userName },
        }));
      }
    };

    const handleUserStopTyping = ({ conversationId }: { conversationId: string }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    };

    const handleNotification = (msg: any) => {
      // Play sound for incoming message
      if (msg.senderId !== user.id) {
        soundManager.playMessageReceived();

        // Browser desktop notification if permitted
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(msg.sender?.displayName || "ConnectPro Message", {
            body: msg.content || (msg.type === "IMAGE" ? "📷 Sent an image" : "Sent a file"),
            icon: msg.sender?.avatar || "/favicon.ico",
          });
        }
      }
    };

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.on("user_status_changed", handleStatusChanged);
    s.on("user_typing", handleUserTyping);
    s.on("user_stop_typing", handleUserStopTyping);
    s.on("message_notification", handleNotification);

    setSocket(s);

    // Request notification permissions
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      s.off("connect", handleConnect);
      s.off("disconnect", handleDisconnect);
      s.off("user_status_changed", handleStatusChanged);
      s.off("user_typing", handleUserTyping);
      s.off("user_stop_typing", handleUserStopTyping);
      s.off("message_notification", handleNotification);
    };
  }, [user]);

  const sendTyping = useCallback(
    (conversationId: string) => {
      if (socket && isConnected && user) {
        socket.emit("typing", {
          conversationId,
          userId: user.id,
          userName: user.displayName,
        });
      }
    },
    [socket, isConnected, user]
  );

  const stopTyping = useCallback(
    (conversationId: string) => {
      if (socket && isConnected && user) {
        socket.emit("stop_typing", {
          conversationId,
          userId: user.id,
        });
      }
    },
    [socket, isConnected, user]
  );

  const notifyNewMessage = useCallback(
    (message: any) => {
      if (socket && isConnected) {
        socket.emit("send_message", message);
      }
    },
    [socket, isConnected]
  );

  const notifyMessageRead = useCallback(
    (conversationId: string, messageIds: string[]) => {
      if (socket && isConnected && user) {
        socket.emit("messages_read", {
          conversationId,
          readerId: user.id,
          messageIds,
        });
      }
    },
    [socket, isConnected, user]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        typingUsers,
        sendTyping,
        stopTyping,
        notifyNewMessage,
        notifyMessageRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
