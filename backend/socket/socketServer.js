import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "../config/db.js";
import authRoutes from "../routes/authRoutes.js";
import messageRoutes from "../routes/messageRoutes.js";
import userRoutes from "../routes/userRoutes.js";
import friendRoutes from "../routes/friendRoutes.js";
import clusterRoutes from "../routes/clusterRoutes.js";

import Message from "../models/Message.js";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";
import Cluster from "../models/Cluster.js";
import ClusterMember from "../models/ClusterMember.js";

import getOrCreateConversation from "../utils/conversation.js";

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

const onlineUsers = new Map();

const getClusterRoom = (clusterId) => {
  return `cluster:${String(clusterId)}`;
};

const getEffectiveStatus = (user, isConnected) => {
  if (!user || !isConnected) {
    return "offline";
  }

  if (user.status === "invisible") {
    return "offline";
  }

  return user.status || "online";
};

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

io.on("connection", (socket) => {
  const userId = String(socket.user.userId);

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  socket.clusterRooms = new Set();

  socket.on("status_changed", async () => {
    await broadcastPresence(userId);
  });

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

  socket.on("send_cluster_invitation", async (data, callback) => {
    const respond = (response) => {
      if (typeof callback === "function") {
        callback(response);
      }
    };

    try {
      const { clusterId, recipient } = data || {};

      if (!clusterId || !recipient) {
        return respond({
          ok: false,
          message: "Cluster and recipient are required",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(clusterId) ||
        !mongoose.Types.ObjectId.isValid(recipient)
      ) {
        return respond({
          ok: false,
          message: "Invalid Cluster or recipient ID",
        });
      }

      const recipientId = String(recipient);

      if (recipientId === userId) {
        return respond({
          ok: false,
          message: "You cannot invite yourself",
        });
      }

      const [sender, recipientUser, cluster] = await Promise.all([
        User.findById(userId),
        User.findById(recipientId),
        Cluster.findOne({
          _id: clusterId,
          isDeleted: false,
        }),
      ]);

      if (!sender || sender.isDeleted) {
        return respond({
          ok: false,
          message: "User no longer exists",
        });
      }

      if (!recipientUser || recipientUser.isDeleted) {
        return respond({
          ok: false,
          message: "User not found",
        });
      }

      if (!cluster) {
        return respond({
          ok: false,
          message: "Cluster not found",
        });
      }

      if (cluster.visibility !== "private") {
        return respond({
          ok: false,
          message: "Invitations are only available for private Clusters",
        });
      }

      if (String(cluster.owner) !== userId) {
        return respond({
          ok: false,
          message: "Only the Cluster owner can send invitations",
        });
      }

      const blockedRelationship =
        sender.blockedUsers.some(
          (blockedId) => String(blockedId) === recipientId,
        ) ||
        recipientUser.blockedUsers.some(
          (blockedId) => String(blockedId) === userId,
        );

      if (blockedRelationship) {
        return respond({
          ok: false,
          message: "You cannot invite this user",
        });
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
        return respond({
          ok: false,
          message: "You can only invite your friends",
        });
      }

      const existingMembership = await ClusterMember.findOne({
        cluster: clusterId,
        user: recipientId,
      });

      if (existingMembership?.status === "active") {
        return respond({
          ok: false,
          message: "This user is already a Cluster member",
        });
      }

      const existingInvitation = await Message.findOne({
        sender: userId,
        recipient: recipientId,
        cluster: null,
        messageType: "cluster_invite",
        "clusterInvite.cluster": clusterId,
        "clusterInvite.status": "pending",
      });

      if (existingInvitation) {
        return respond({
          ok: false,
          message: "An invitation is already pending",
        });
      }

      const conversation = await getOrCreateConversation(userId, recipientId);

      const deliveryStatus = isUserOnline(recipientId) ? "delivered" : "sent";

      const message = await Message.create({
        sender: userId,
        senderUsername: sender.username,
        recipient: recipientId,
        cluster: null,
        content: cluster.name,
        messageType: "cluster_invite",
        clusterInvite: {
          cluster: cluster._id,
          status: "pending",
        },
        status: deliveryStatus,
      });

      await message.populate("sender", "username displayName profilePicture");

      await message.populate(
        "recipient",
        "username displayName profilePicture",
      );

      await message.populate(
        "clusterInvite.cluster",
        "name description profilePicture visibility owner",
      );

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

      respond({
        ok: true,
        message: "Cluster invitation sent",
        invitation: message,
      });
    } catch (error) {
      console.error("Cluster invitation error:", error);

      respond({
        ok: false,
        message: "Failed to send Cluster invitation",
      });
    }
  });

  socket.on("cluster_invitation_response", async (data) => {
    try {
      const { messageId, action } = data || {};

      if (!messageId || !["accept", "reject"].includes(action)) {
        return socket.emit("cluster_invitation_error", {
          message: "Invalid invitation response",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return socket.emit("cluster_invitation_error", {
          message: "Invalid invitation ID",
        });
      }

      const invitation = await Message.findOne({
        _id: messageId,
        recipient: userId,
        cluster: null,
        messageType: "cluster_invite",
      });

      if (!invitation) {
        return socket.emit("cluster_invitation_error", {
          message: "Invitation not found",
        });
      }

      if (invitation.clusterInvite?.status !== "pending") {
        return socket.emit("cluster_invitation_error", {
          message: "This invitation has already been handled",
        });
      }

      const clusterId = invitation.clusterInvite.cluster;

      const cluster = await Cluster.findOne({
        _id: clusterId,
        visibility: "private",
        isDeleted: false,
      });

      if (!cluster) {
        invitation.clusterInvite.status = "rejected";
        await invitation.save();

        emitToUser(invitation.sender.toString(), "cluster_invitation_updated", {
          messageId: invitation._id.toString(),
          status: "rejected",
        });

        return socket.emit("cluster_invitation_updated", {
          messageId: invitation._id.toString(),
          status: "rejected",
        });
      }

      if (action === "accept") {
        const membership = await ClusterMember.findOne({
          cluster: clusterId,
          user: userId,
        });

        if (membership) {
          membership.status = "active";
          membership.role = "member";
          await membership.save();
        } else {
          await ClusterMember.create({
            cluster: clusterId,
            user: userId,
            status: "active",
            role: "member",
          });
        }

        invitation.clusterInvite.status = "accepted";
        invitation.status = "read";

        await invitation.save();

        const [updatedCluster, memberCount] = await Promise.all([
          Cluster.findById(cluster._id).populate(
            "owner",
            "username displayName profilePicture",
          ),
          ClusterMember.countDocuments({
            cluster: cluster._id,
            status: "active",
          }),
        ]);

        const clusterPayload = {
          _id: updatedCluster._id,
          name: updatedCluster.name,
          description: updatedCluster.description,
          profilePicture: updatedCluster.profilePicture || "",
          visibility: updatedCluster.visibility,
          inviteCode:
            updatedCluster.visibility === "private"
              ? updatedCluster.inviteCode || ""
              : "",
          owner: updatedCluster.owner,
          memberCount,
          createdAt: updatedCluster.createdAt,
        };

        emitToUser(userId, "cluster_joined_realtime", {
          cluster: clusterPayload,
        });

        emitToUser(cluster.owner.toString(), "cluster_member_joined", {
          clusterId: cluster._id.toString(),
          userId,
          cluster: clusterPayload,
        });

        emitToUser(invitation.sender.toString(), "cluster_invitation_updated", {
          messageId: invitation._id.toString(),
          status: "accepted",
        });

        return socket.emit("cluster_invitation_updated", {
          messageId: invitation._id.toString(),
          status: "accepted",
          cluster: clusterPayload,
        });
      }

      invitation.clusterInvite.status = "rejected";

      await invitation.save();

      emitToUser(invitation.sender.toString(), "cluster_invitation_updated", {
        messageId: invitation._id.toString(),
        status: "rejected",
      });

      socket.emit("cluster_invitation_updated", {
        messageId: invitation._id.toString(),
        status: "rejected",
      });
    } catch (error) {
      console.error("Cluster invitation response error:", error);

      socket.emit("cluster_invitation_error", {
        message: "Failed to respond to Cluster invitation",
      });
    }
  });

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

  (async () => {
    await broadcastPresence(userId);

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
  })();
});

connectDB();

httpServer.listen(PORT, () => {
  console.log(`Chime backend running on port ${PORT}`);
});
