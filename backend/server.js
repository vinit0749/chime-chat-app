import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";

import Message from "./models/Message.js";
import User from "./models/User.js";
import Friendship from "./models/Friendship.js";
import Conversation from "./models/Conversation.js";

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
  CONVERSATIONS
  ============================================================
*/

const getOrCreateConversation = async (userId, recipientId) => {
  const participants = [String(userId), String(recipientId)].sort();

  let conversation = await Conversation.findOne({
    participants: {
      $all: participants,
    },
  });

  if (conversation) {
    return conversation;
  }

  try {
    conversation = await Conversation.create({
      participants,
    });

    return conversation;
  } catch (error) {
    conversation = await Conversation.findOne({
      participants: {
        $all: participants,
      },
    });

    if (conversation) {
      return conversation;
    }

    throw error;
  }
};

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
    Register socket.
  */

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  /*
    Broadcast this user's presence.
  */

  await broadcastPresence(userId);

  /*
    Tell the newly connected user about everyone
    who is already online.
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
    MARK MESSAGES READ
    ==========================================================
  */

  socket.on("mark_messages_read", async (data) => {
    try {
      const { senderId } = data;

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
    SEND MESSAGE
    ==========================================================

    Supports:
    - Normal messages
    - Reply messages
  */

  socket.on("send_message", async (data) => {
    try {
      const { content, recipient, room, replyTo } = data;

      if (!content || !content.trim()) {
        return;
      }

      const sender = await User.findById(userId);

      if (!sender || sender.isDeleted) {
        console.error("Message sender no longer exists");
        return;
      }

      /*
        ======================================================
        DIRECT MESSAGE
        ======================================================
      */

      if (recipient) {
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

        /*
          Only friends can send DMs.
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
          console.error("Users are not friends");
          return;
        }

        /*
          Get/create persistent conversation.
        */

        const conversation = await getOrCreateConversation(userId, recipientId);

        /*
          Validate reply target if provided.
        */

        let validReplyTo = null;

        if (replyTo) {
          const repliedMessage = await Message.findById(replyTo);

          if (repliedMessage) {
            const belongsToConversation =
              (String(repliedMessage.sender) === userId &&
                String(repliedMessage.recipient) === recipientId) ||
              (String(repliedMessage.sender) === recipientId &&
                String(repliedMessage.recipient) === userId);

            if (belongsToConversation) {
              validReplyTo = repliedMessage._id;
            }
          }
        }

        /*
          Determine delivery status.
        */

        const deliveryStatus = isUserOnline(recipientId) ? "delivered" : "sent";

        /*
          Create message.
        */

        const message = await Message.create({
          sender: userId,
          senderUsername: sender.username,
          recipient: recipientId,
          content: content.trim(),
          room: null,
          status: deliveryStatus,
          replyTo: validReplyTo,
        });

        await message.populate("sender", "username displayName profilePicture");

        await message.populate(
          "recipient",
          "username displayName profilePicture",
        );

        /*
          Populate replied-to message.
        */

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

        /*
          Update conversation.
        */

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;

        await conversation.save();

        /*
          ====================================================
          REAL-TIME MESSAGE
          ====================================================
        */

        emitToUser(userId, "new_message", message);

        if (deliveryStatus === "delivered") {
          emitToUser(recipientId, "new_message", message);
        }

        /*
          ====================================================
          REAL-TIME CONVERSATION UPDATE
          ====================================================
        */

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

        return;
      }

      /*
        ======================================================
        PUBLIC ROOM MESSAGE
        ======================================================
      */

      let validReplyTo = null;

      if (replyTo) {
        const repliedMessage = await Message.findById(replyTo);

        if (repliedMessage && repliedMessage.room === (room || "general")) {
          validReplyTo = repliedMessage._id;
        }
      }

      const message = await Message.create({
        sender: userId,
        senderUsername: sender.username,
        recipient: null,
        content: content.trim(),
        room: room || "general",
        replyTo: validReplyTo,
      });

      await message.populate("sender", "username displayName profilePicture");

      if (message.replyTo) {
        await message.populate({
          path: "replyTo",
          select: "sender senderUsername content createdAt room",
          populate: {
            path: "sender",
            select: "username displayName profilePicture",
          },
        });
      }

      /*
        Public room messages are immediately
        broadcast to every connected client.
      */

      io.emit("new_message", message);
    } catch (error) {
      console.error("Socket message error:", error);
    }
  });

  /*
    ==========================================================
    EDIT MESSAGE
    ==========================================================

    Only the original sender can edit their own message.

    Supports:
    - Direct messages
    - Public room messages

    The updated message is broadcast in real time
    to every relevant client.
  */

  socket.on("edit_message", async (data) => {
    try {
      const { messageId, content } = data;

      if (!messageId || !content || !content.trim()) {
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        console.error("Invalid message ID for edit");
        return;
      }

      const trimmedContent = content.trim();

      if (trimmedContent.length > 2000) {
        console.error("Edited message is too long");
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        console.error("Message not found for edit");
        return;
      }

      /*
        Only the original sender can edit
        their own message.
      */

      if (String(message.sender) !== userId) {
        console.error("User can only edit their own messages");
        return;
      }

      /*
        Update message content and edited state.
      */

      message.content = trimmedContent;
      message.edited = true;

      await message.save();

      /*
        Save only the data required by the frontend.
      */

      const editedMessageData = {
        messageId: message._id.toString(),
        content: message.content,
        edited: message.edited,
        updatedAt: message.updatedAt,
      };

      /*
        DM message.
      */

      if (message.recipient) {
        emitToUser(
          message.recipient.toString(),
          "message_edited",
          editedMessageData,
        );

        /*
          Also update every other tab/device
          belonging to the sender.
        */

        emitToUser(userId, "message_edited", editedMessageData);

        return;
      }

      /*
        Public room message.

        Everyone connected should receive
        the edited message.
      */

      io.emit("message_edited", editedMessageData);
    } catch (error) {
      console.error("Edit message error:", error);
    }
  });

  /*
    ==========================================================
    DISCONNECT
    ==========================================================
  */

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id);

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
