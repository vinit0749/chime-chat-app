import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import clusterRoutes from "./routes/clusterRoutes.js";

import Message from "./models/Message.js";
import User from "./models/User.js";
import Friendship from "./models/Friendship.js";
import Cluster from "./models/Cluster.js";
import ClusterMember from "./models/ClusterMember.js";

import getOrCreateConversation from "./utils/conversation.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.set("io", io);

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/clusters", clusterRoutes);

app.get("/", (req, res) => {
  res.send("Chime backend is running!");
});

/*
  ============================================================
  ONLINE USERS
  ============================================================
*/

const onlineUsers = new Map();

/*
  ============================================================
  CLUSTER SOCKET ROOM HELPER
  ============================================================
*/

const getClusterRoom = (clusterId) => {
  return `cluster:${String(clusterId)}`;
};

/*
  ============================================================
  PRESENCE
  ============================================================
*/

const getEffectiveStatus = (user, isConnected) => {
  if (!user || !isConnected) {
    return "offline";
  }

  if (user.status === "invisible") {
    return "offline";
  }

  return user.status || "online";
};

const broadcastPresence = async (userId) => {
  try {
    const user = await User.findById(userId).select("status isDeleted");

    if (!user || user.isDeleted) {
      return;
    }

    const sockets = onlineUsers.get(String(userId));
    const isConnected = Boolean(sockets && sockets.size > 0);

    const status = getEffectiveStatus(user, isConnected);

    io.emit("presence_update", {
      userId: String(userId),
      status,
    });
  } catch (error) {
    console.error("Failed to broadcast presence:", error);
  }
};

const isUserOnline = (userId) => {
  const sockets = onlineUsers.get(String(userId));

  return Boolean(sockets && sockets.size > 0);
};

/*
  ============================================================
  REAL-TIME USER EVENT HELPER
  ============================================================
*/

const emitToUser = (userId, event, data) => {
  const sockets = onlineUsers.get(String(userId));

  if (!sockets) {
    return;
  }

  sockets.forEach((socketId) => {
    io.to(socketId).emit(event, data);
  });
};

app.set("emitToUser", emitToUser);

/*
  ============================================================
  SOCKET AUTHENTICATION
  ============================================================
*/

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = decoded;

    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

/*
  ============================================================
  SOCKET CONNECTION
  ============================================================
*/

io.on("connection", async (socket) => {
  const userId = String(socket.user.userId);

  console.log("Authenticated socket connected:", socket.id);
  console.log("User ID:", userId);

  /*
    ==========================================================
    REGISTER SOCKET
    ==========================================================
  */

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  socket.clusterRooms = new Set();

  /*
    ==========================================================
    BROADCAST THIS USER'S PRESENCE
    ==========================================================
  */

  await broadcastPresence(userId);

  /*
    ==========================================================
    SEND EXISTING ONLINE USERS
    ==========================================================
  */

  for (const [onlineUserId, sockets] of onlineUsers.entries()) {
    if (onlineUserId === userId || sockets.size === 0) {
      continue;
    }

    try {
      const onlineUser =
        await User.findById(onlineUserId).select("status isDeleted");

      if (!onlineUser || onlineUser.isDeleted) {
        continue;
      }

      socket.emit("presence_update", {
        userId: onlineUserId,
        status: getEffectiveStatus(onlineUser, true),
      });
    } catch (error) {
      console.error("Failed to send existing presence:", error);
    }
  }

  /*
    ==========================================================
    STATUS CHANGED
    ==========================================================
  */

  socket.on("status_changed", async () => {
    console.log(`Presence status changed for user ${userId}`);

    await broadcastPresence(userId);
  });

  /*
    ==========================================================
    MESSAGE DELIVERY
    ==========================================================
  */

  try {
    const pendingMessages = await Message.find({
      recipient: userId,
      status: "sent",
    }).select("_id sender");

    if (pendingMessages.length > 0) {
      await Message.updateMany(
        {
          recipient: userId,
          status: "sent",
        },
        {
          $set: {
            status: "delivered",
          },
        },
      );

      for (const message of pendingMessages) {
        emitToUser(message.sender.toString(), "message_delivered", {
          messageId: message._id.toString(),
        });
      }
    }
  } catch (error) {
    console.error("Failed to update pending message delivery:", error);
  }

  /*
    ==========================================================
    MARK DIRECT MESSAGES READ
    ==========================================================
  */

  socket.on("mark_messages_read", async (data) => {
    try {
      const { senderId } = data || {};

      if (!senderId) {
        return;
      }

      const senderIdString = String(senderId);

      const unreadMessages = await Message.find({
        sender: senderIdString,
        recipient: userId,
        status: "delivered",
      }).select("_id");

      if (unreadMessages.length === 0) {
        return;
      }

      const messageIds = unreadMessages.map((message) => String(message._id));

      const updateResult = await Message.updateMany(
        {
          _id: {
            $in: unreadMessages.map((message) => message._id),
          },
          sender: senderIdString,
          recipient: userId,
          status: "delivered",
        },
        {
          $set: {
            status: "read",
          },
        },
      );

      console.log(
        `[READ] ${userId} marked ${updateResult.modifiedCount} message(s) as read.`,
      );

      emitToUser(senderIdString, "messages_read", {
        messageIds,
      });
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  });

  /*
    ==========================================================
    DIRECT MESSAGE TYPING
    ==========================================================
  */

  socket.on("typing_start", async (data) => {
    try {
      const { recipient } = data || {};

      if (!recipient) {
        return;
      }

      const recipientId = String(recipient);

      if (recipientId === userId) {
        return;
      }

      const recipientUser =
        await User.findById(recipientId).select("_id isDeleted");

      if (!recipientUser || recipientUser.isDeleted) {
        return;
      }

      const friendship = await Friendship.findOne({
        status: "accepted",
        $or: [
          {
            requester: userId,
            recipient: recipientId,
          },
          {
            requester: recipientId,
            recipient: userId,
          },
        ],
      });

      if (!friendship) {
        return;
      }

      emitToUser(recipientId, "typing_start", {
        userId,
      });
    } catch (error) {
      console.error("Typing start error:", error);
    }
  });

  socket.on("typing_stop", async (data) => {
    try {
      const { recipient } = data || {};

      if (!recipient) {
        return;
      }

      const recipientId = String(recipient);

      if (recipientId === userId) {
        return;
      }

      const friendship = await Friendship.findOne({
        status: "accepted",
        $or: [
          {
            requester: userId,
            recipient: recipientId,
          },
          {
            requester: recipientId,
            recipient: userId,
          },
        ],
      });

      if (!friendship) {
        return;
      }

      emitToUser(recipientId, "typing_stop", {
        userId,
      });
    } catch (error) {
      console.error("Typing stop error:", error);
    }
  });

  /*
    ==========================================================
    JOIN CLUSTER
    ==========================================================
  */

  socket.on("join_cluster", async (data) => {
    try {
      const { clusterId } = data || {};

      if (!clusterId) {
        return socket.emit("cluster_error", {
          message: "Cluster ID is required",
        });
      }

      if (!/^[a-fA-F0-9]{24}$/.test(String(clusterId))) {
        return socket.emit("cluster_error", {
          message: "Invalid Cluster ID",
        });
      }

      const cluster = await Cluster.findOne({
        _id: clusterId,
        isDeleted: false,
      });

      if (!cluster) {
        return socket.emit("cluster_error", {
          message: "Cluster not found",
        });
      }

      const membership = await ClusterMember.findOne({
        cluster: clusterId,
        user: userId,
        status: "active",
      });

      if (!membership) {
        return socket.emit("cluster_error", {
          message: "You are not a member of this Cluster",
        });
      }

      const clusterIdString = String(clusterId);
      const clusterRoom = getClusterRoom(clusterIdString);

      if (socket.clusterRooms.has(clusterIdString)) {
        return socket.emit("cluster_joined", {
          clusterId: clusterIdString,
        });
      }

      await socket.join(clusterRoom);

      socket.clusterRooms.add(clusterIdString);

      console.log(`User ${userId} joined Cluster ${clusterIdString}`);

      socket.emit("cluster_joined", {
        clusterId: clusterIdString,
      });

      socket.to(clusterRoom).emit("cluster_member_online", {
        clusterId: clusterIdString,
        userId,
      });
    } catch (error) {
      console.error("Join Cluster socket error:", error);

      socket.emit("cluster_error", {
        message: "Failed to join Cluster",
      });
    }
  });

  /*
    ==========================================================
    LEAVE CLUSTER
    ==========================================================
  */

  socket.on("leave_cluster", async (data) => {
    try {
      const { clusterId } = data || {};

      if (!clusterId) {
        return;
      }

      const clusterIdString = String(clusterId);
      const clusterRoom = getClusterRoom(clusterIdString);

      if (!socket.clusterRooms.has(clusterIdString)) {
        return;
      }

      await socket.leave(clusterRoom);

      socket.clusterRooms.delete(clusterIdString);

      console.log(`User ${userId} left Cluster ${clusterIdString}`);

      socket.to(clusterRoom).emit("cluster_member_offline", {
        clusterId: clusterIdString,
        userId,
      });

      socket.emit("cluster_left", {
        clusterId: clusterIdString,
      });
    } catch (error) {
      console.error("Leave Cluster socket error:", error);
    }
  });

  /*
    ==========================================================
    CLUSTER TYPING START
    ==========================================================
  */

  socket.on("cluster_typing_start", async (data) => {
    try {
      const { clusterId } = data || {};

      if (!clusterId) {
        return;
      }

      const clusterIdString = String(clusterId);

      const membership = await ClusterMember.findOne({
        cluster: clusterIdString,
        user: userId,
        status: "active",
      });

      if (!membership) {
        return;
      }

      if (!socket.clusterRooms.has(clusterIdString)) {
        return;
      }

      const clusterRoom = getClusterRoom(clusterIdString);

      socket.to(clusterRoom).emit("cluster_typing_start", {
        clusterId: clusterIdString,
        userId,
      });
    } catch (error) {
      console.error("Cluster typing start error:", error);
    }
  });

  /*
    ==========================================================
    CLUSTER TYPING STOP
    ==========================================================
  */

  socket.on("cluster_typing_stop", async (data) => {
    try {
      const { clusterId } = data || {};

      if (!clusterId) {
        return;
      }

      const clusterIdString = String(clusterId);

      const membership = await ClusterMember.findOne({
        cluster: clusterIdString,
        user: userId,
        status: "active",
      });

      if (!membership) {
        return;
      }

      if (!socket.clusterRooms.has(clusterIdString)) {
        return;
      }

      const clusterRoom = getClusterRoom(clusterIdString);

      socket.to(clusterRoom).emit("cluster_typing_stop", {
        clusterId: clusterIdString,
        userId,
      });
    } catch (error) {
      console.error("Cluster typing stop error:", error);
    }
  });

  /*
    ==========================================================
    SEND CLUSTER MESSAGE
    ==========================================================
  */

  socket.on("send_cluster_message", async (data) => {
    try {
      const { clusterId, content, replyTo } = data || {};

      if (!clusterId) {
        return socket.emit("cluster_error", {
          message: "Cluster ID is required",
        });
      }

      if (!content || !content.trim()) {
        return;
      }

      if (!/^[a-fA-F0-9]{24}$/.test(String(clusterId))) {
        return socket.emit("cluster_error", {
          message: "Invalid Cluster ID",
        });
      }

      const clusterIdString = String(clusterId);

      const sender = await User.findById(userId);

      if (!sender || sender.isDeleted) {
        return socket.emit("cluster_error", {
          message: "User no longer exists",
        });
      }

      const cluster = await Cluster.findOne({
        _id: clusterIdString,
        isDeleted: false,
      });

      if (!cluster) {
        return socket.emit("cluster_error", {
          message: "Cluster not found",
        });
      }

      const membership = await ClusterMember.findOne({
        cluster: clusterIdString,
        user: userId,
        status: "active",
      });

      if (!membership) {
        return socket.emit("cluster_error", {
          message: "You are not a member of this Cluster",
        });
      }

      if (!socket.clusterRooms.has(clusterIdString)) {
        return socket.emit("cluster_error", {
          message: "You are not connected to this Cluster",
        });
      }

      const clusterRoom = getClusterRoom(clusterIdString);

      let validReplyTo = null;

      if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
        const repliedMessage = await Message.findOne({
          _id: replyTo,
          cluster: clusterIdString,
        });

        if (repliedMessage) {
          validReplyTo = repliedMessage._id;
        }
      }

      const message = await Message.create({
        sender: userId,
        senderUsername: sender.username,
        recipient: null,
        content: content.trim(),
        cluster: clusterIdString,
        status: "delivered",
        replyTo: validReplyTo,
      });

      await message.populate("sender", "username displayName profilePicture");

      if (message.replyTo) {
        await message.populate({
          path: "replyTo",
          select: "sender senderUsername content createdAt cluster",
          populate: {
            path: "sender",
            select: "username displayName profilePicture",
          },
        });
      }

      io.to(clusterRoom).emit("new_cluster_message", {
        clusterId: clusterIdString,
        message,
      });
    } catch (error) {
      console.error("Cluster message error:", error);

      socket.emit("cluster_error", {
        message: "Failed to send Cluster message",
      });
    }
  });

  /*
    ==========================================================
    DISCONNECT
    ==========================================================
  */

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id);

    if (socket.clusterRooms) {
      for (const clusterId of socket.clusterRooms) {
        const clusterRoom = getClusterRoom(clusterId);

        socket.to(clusterRoom).emit("cluster_member_offline", {
          clusterId: String(clusterId),
          userId,
        });
      }
    }

    const sockets = onlineUsers.get(userId);

    if (sockets) {
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        onlineUsers.delete(userId);
      }
    }

    await broadcastPresence(userId);
  });

  /*
    ==========================================================
    SEND DIRECT MESSAGE
    ==========================================================
  */

  socket.on("send_message", async (data) => {
    try {
      const { content, recipient, replyTo } = data || {};

      if (!content || !content.trim()) {
        return;
      }

      if (!recipient) {
        console.error(
          "send_message requires a recipient. Use send_cluster_message for Clusters.",
        );

        return;
      }

      const sender = await User.findById(userId);

      if (!sender || sender.isDeleted) {
        console.error("Message sender no longer exists");
        return;
      }

      const recipientId = String(recipient);

      const recipientUser = await User.findById(recipientId);

      if (!recipientUser || recipientUser.isDeleted) {
        console.error("Message recipient no longer exists");
        return;
      }

      if (recipientId === userId) {
        console.error("User cannot message themselves");
        return;
      }

      const friendship = await Friendship.findOne({
        status: "accepted",
        $or: [
          {
            requester: userId,
            recipient: recipientId,
          },
          {
            requester: recipientId,
            recipient: userId,
          },
        ],
      });

      if (!friendship) {
        console.error("Users are not friends");
        return;
      }

      const conversation = await getOrCreateConversation(userId, recipientId);

      let validReplyTo = null;

      if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
        const repliedMessage = await Message.findOne({
          _id: replyTo,
          cluster: null,
          $or: [
            {
              sender: userId,
              recipient: recipientId,
            },
            {
              sender: recipientId,
              recipient: userId,
            },
          ],
        });

        if (repliedMessage) {
          validReplyTo = repliedMessage._id;
        }
      }

      const deliveryStatus = isUserOnline(recipientId) ? "delivered" : "sent";

      const message = await Message.create({
        sender: userId,
        senderUsername: sender.username,
        recipient: recipientId,
        content: content.trim(),
        cluster: null,
        status: deliveryStatus,
        replyTo: validReplyTo,
      });

      await message.populate("sender", "username displayName profilePicture");

      await message.populate(
        "recipient",
        "username displayName profilePicture",
      );

      if (message.replyTo) {
        await message.populate({
          path: "replyTo",
          select: "sender senderUsername content createdAt",
          populate: {
            path: "sender",
            select: "username displayName profilePicture",
          },
        });
      }

      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;

      await conversation.save();

      emitToUser(userId, "new_message", message);

      if (deliveryStatus === "delivered") {
        emitToUser(recipientId, "new_message", message);
      }

      const conversationUpdate = {
        conversationId: conversation._id.toString(),
        userId: recipientId,
        lastMessage: {
          _id: message._id.toString(),
          content: message.content,
          createdAt: message.createdAt,
        },
      };

      emitToUser(userId, "conversation_updated", conversationUpdate);

      emitToUser(recipientId, "conversation_updated", {
        ...conversationUpdate,
        userId,
      });
    } catch (error) {
      console.error("Socket message error:", error);
    }
  });
});

/*
  ============================================================
  DATABASE + SERVER
  ============================================================
*/

connectDB();

httpServer.listen(PORT, () => {
  console.log(`Chime backend running on port ${PORT}`);
});
