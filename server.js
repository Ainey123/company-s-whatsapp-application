const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory mapping of active users to socket IDs
// userId -> Set<socketId>
const userSockets = new Map();
// socketId -> userId
const socketUser = new Map();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling request:", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 1e8, // 100 MB max for file/voice transfers
  });

  // Make io accessible globally for API routes
  global.io = io;

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId && typeof userId === "string") {
      socketUser.set(socket.id, userId);

      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);

      // Join individual user room
      socket.join(`user:${userId}`);

      // Broadcast user online status to all connected clients
      io.emit("user_status_changed", {
        userId,
        isOnline: true,
        lastSeen: new Date().toISOString(),
      });
    }

    // Join a conversation room (groups or 1-on-1s)
    socket.on("join_conversation", (conversationId) => {
      if (conversationId) {
        socket.join(`conv:${conversationId}`);
      }
    });

    // Leave a conversation room
    socket.on("leave_conversation", (conversationId) => {
      if (conversationId) {
        socket.leave(`conv:${conversationId}`);
      }
    });

    // Typing indicators
    socket.on("typing", ({ conversationId, userId, userName }) => {
      socket.to(`conv:${conversationId}`).emit("user_typing", {
        conversationId,
        userId,
        userName,
      });
    });

    socket.on("stop_typing", ({ conversationId, userId }) => {
      socket.to(`conv:${conversationId}`).emit("user_stop_typing", {
        conversationId,
        userId,
      });
    });

    // Real-time message dispatch
    socket.on("send_message", (messageData) => {
      const { conversationId } = messageData;
      if (conversationId) {
        // Emit to everyone in the conversation room including other tabs of sender
        io.to(`conv:${conversationId}`).emit("new_message", messageData);

        // Also notify recipients in their private rooms for badge/notifications
        if (Array.isArray(messageData.recipientIds)) {
          messageData.recipientIds.forEach((recipientId) => {
            if (recipientId !== messageData.senderId) {
              io.to(`user:${recipientId}`).emit("message_notification", messageData);
            }
          });
        }
      }
    });

    // Message read receipts
    socket.on("messages_read", ({ conversationId, readerId, messageIds }) => {
      if (conversationId) {
        io.to(`conv:${conversationId}`).emit("receipt_updated", {
          conversationId,
          readerId,
          messageIds,
          status: "READ",
          readAt: new Date().toISOString(),
        });
      }
    });

    // Message edit / delete
    socket.on("message_updated", (updatedMessage) => {
      if (updatedMessage.conversationId) {
        io.to(`conv:${updatedMessage.conversationId}`).emit("message_edited", updatedMessage);
      }
    });

    socket.on("message_deleted", ({ messageId, conversationId }) => {
      if (conversationId) {
        io.to(`conv:${conversationId}`).emit("message_deleted", { messageId, conversationId });
      }
    });

    // ==========================================
    // WebRTC Real-Time 1-on-1 Audio/Video Calling
    // ==========================================

    socket.on("call_user", ({ recipientId, caller, callType, offer }) => {
      // Forward incoming call to recipient's user room
      io.to(`user:${recipientId}`).emit("incoming_call", {
        caller,
        callType,
        offer,
      });
    });

    socket.on("answer_call", ({ targetUserId, answer }) => {
      io.to(`user:${targetUserId}`).emit("call_answered", {
        answer,
        answeredBy: socketUser.get(socket.id),
      });
    });

    socket.on("ice_candidate", ({ targetUserId, candidate }) => {
      io.to(`user:${targetUserId}`).emit("ice_candidate", {
        candidate,
        fromUserId: socketUser.get(socket.id),
      });
    });

    socket.on("reject_call", ({ targetUserId, reason }) => {
      io.to(`user:${targetUserId}`).emit("call_rejected", {
        reason: reason || "declined",
        byUserId: socketUser.get(socket.id),
      });
    });

    socket.on("end_call", ({ targetUserId }) => {
      io.to(`user:${targetUserId}`).emit("call_ended", {
        byUserId: socketUser.get(socket.id),
      });
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      const uId = socketUser.get(socket.id);
      socketUser.delete(socket.id);

      if (uId && userSockets.has(uId)) {
        const sockets = userSockets.get(uId);
        sockets.delete(socket.id);

        if (sockets.size === 0) {
          userSockets.delete(uId);
          // Broadcast user offline
          io.emit("user_status_changed", {
            userId: uId,
            isOnline: false,
            lastSeen: new Date().toISOString(),
          });
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`> ConnectPro Server is ready on http://${hostname}:${port}`);
  });
});
