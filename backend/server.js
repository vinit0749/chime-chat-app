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

/*
  Check whether either user has blocked the other.
 *
 * This is intentionally symmetric:
 *
 * A blocked B
 * OR
 * B blocked A
 *
 * means A must see B as offline.
 */
const areUsersBlocked = (currentUser, targetUserId) => {
  if (!currentUser || !targetUserId) {
    return false;
  }

  const normalizedTargetId = String(targetUserId);

  return (currentUser.blockedUsers || []).some(
    (blockedId) => String(blockedId) === normalizedTargetId,
  );
};

/*
  Get whether the relationship between two users is blocked
  in either direction.
 */
const isBlockedRelationship = (userA, userB) => {
  if (!userA || !userB) {
    return false;
  }

  const userAId = String(userA._id);
  const userBId = String(userB._id);

  const aBlockedB = (userA.blockedUsers || []).some(
    (blockedId) => String(blockedId) === userBId,
  );

  const bBlockedA = (userB.blockedUsers || []).some(
    (blockedId) => String(blockedId) === userAId,
  );

  return aBlockedB || bBlockedA;
};

/*
  Broadcast a user's presence while respecting block privacy.

  IMPORTANT:
  We do NOT use io.emit() here.

  Every connected recipient gets their own presence value:
  - normal relationship -> actual status
  - blocked relationship -> offline
*/
const broadcastPresence = async (userId) => {
  try {
    const normalizedUserId = String(userId);

    const user = await User.findById(normalizedUserId).select(
      "status isDeleted blockedUsers",
    );

    if (!user || user.isDeleted) {
      return;
    }

    const sockets = onlineUsers.get(normalizedUserId);
    const isConnected = Boolean(sockets && sockets.size > 0);

    const actualStatus = getEffectiveStatus(user, isConnected);

    /*
      Get every currently connected user.

      We fetch their blockedUsers in one query so we can determine
      the relationship without performing one DB query per socket.
    */
    const onlineUserIds = Array.from(onlineUsers.entries())
      .filter(([, userSockets]) => userSockets && userSockets.size > 0)
      .map(([connectedUserId]) => connectedUserId);

    if (onlineUserIds.length === 0) {
      return;
    }

    const connectedUsers = await User.find({
      _id: {
        $in: onlineUserIds,
      },
      isDeleted: false,
    }).select("_id blockedUsers");

    const connectedUsersById = new Map(
      connectedUsers.map((connectedUser) => [
        String(connectedUser._id),
        connectedUser,
      ]),
    );

    /*
      Send the presence separately to every connected user.
    */
    for (const recipientId of onlineUserIds) {
      const recipientSockets = onlineUsers.get(recipientId);

      if (!recipientSockets || recipientSockets.size === 0) {
        continue;
      }

      const recipientUser = connectedUsersById.get(recipientId);

      const blockedRelationship = isBlockedRelationship(user, recipientUser);

      const statusToSend = blockedRelationship ? "offline" : actualStatus;

      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit("presence_update", {
          userId: normalizedUserId,
          status: statusToSend,
        });
      });
    }
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

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  socket.clusterRooms = new Set();

  /*
    Broadcast this user's presence.

    This now automatically respects blocking for every recipient.
  */
  await broadcastPresence(userId);

  /*
    ==========================================================
    SEND EXISTING ONLINE USERS
    ==========================================================
  */

  /*
    Load the newly connected user's current block list once.
    This allows us to determine whether each existing online user
    should appear online or offline.
  */
  const currentUser = await User.findById(userId).select("_id blockedUsers");

  for (const [onlineUserId, sockets] of onlineUsers.entries()) {
    if (onlineUserId === userId || sockets.size === 0) {
      continue;
    }

    try {
      const onlineUser = await User.findById(onlineUserId).select(
        "_id status isDeleted blockedUsers",
      );

      if (!onlineUser || onlineUser.isDeleted) {
        continue;
      }

      const blockedRelationship = isBlockedRelationship(
        currentUser,
        onlineUser,
      );

      socket.emit("presence_update", {
        userId: onlineUserId,
        status: blockedRelationship
          ? "offline"
          : getEffectiveStatus(onlineUser, true),
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
    ============================================================
    MARK DIRECT MESSAGES READ
    ============================================================
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

      await Message.updateMany(
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

      emitToUser(senderIdString, "messages_read", {
        messageIds,
      });
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  });

  /*
    ============================================================
    DIRECT MESSAGE TYPING
    ============================================================
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

      /*
        Do not allow typing indicators across a blocked relationship.
      */
      const [currentUser, targetUser] = await Promise.all([
        User.findById(userId).select("blockedUsers"),
        User.findById(recipientId).select("blockedUsers"),
      ]);

      if (!currentUser || !targetUser) {
        return;
      }

      const isBlocked =
        currentUser.blockedUsers.some(
          (blockedId) => String(blockedId) === recipientId,
        ) ||
        targetUser.blockedUsers.some(
          (blockedId) => String(blockedId) === userId,
        );

      if (isBlocked) {
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
    ============================================================
    JOIN CLUSTER
    ============================================================
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
    ============================================================
    LEAVE CLUSTER
    ============================================================
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
    ============================================================
    CLUSTER TYPING START
    ============================================================
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

      if (!membership || !socket.clusterRooms.has(clusterIdString)) {
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
    ============================================================
    CLUSTER TYPING STOP
    ============================================================
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

      if (!membership || !socket.clusterRooms.has(clusterIdString)) {
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
    ============================================================
    SEND CLUSTER MESSAGE
    ============================================================
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
    ============================================================
    SEND DIRECT MESSAGE
    ============================================================
  */

  socket.on("send_message", async (data) => {
    try {
      const { content, recipient, replyTo } = data || {};

      if (!content || !content.trim()) {
        return;
      }

      if (!recipient) {
        return;
      }

      const sender = await User.findById(userId);

      if (!sender || sender.isDeleted) {
        return;
      }

      const recipientId = String(recipient);

      if (recipientId === userId) {
        return;
      }

      const recipientUser = await User.findById(recipientId);

      if (!recipientUser || recipientUser.isDeleted) {
        return;
      }

      /*
        ======================================================
        BLOCK CHECK
        ======================================================
      */

      const senderHasBlockedRecipient = sender.blockedUsers.some(
        (blockedId) => String(blockedId) === recipientId,
      );

      const recipientHasBlockedSender = recipientUser.blockedUsers.some(
        (blockedId) => String(blockedId) === userId,
      );

      if (senderHasBlockedRecipient || recipientHasBlockedSender) {
        socket.emit("message_error", {
          message: "You cannot message this user.",
        });

        return;
      }

      /*
        ======================================================
        FRIENDSHIP CHECK
        ======================================================
      */

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
        socket.emit("message_error", {
          message: "You must be friends with this user to send messages.",
        });

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

  /*
    ============================================================
    DISCONNECT
    ============================================================
  */

  socket.on("disconnect", async () => {
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
