import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (userId?: string): Socket => {
  if (!socket && typeof window !== "undefined") {
    socket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      query: userId ? { userId } : {},
    });
  }

  if (socket && userId && !socket.connected) {
    socket.io.opts.query = { userId };
  }

  return socket as Socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
