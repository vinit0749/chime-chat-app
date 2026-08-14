import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";
import Conversation from "../models/Conversation.js";

/*
  Get or create a DM conversation.

  The two participant IDs are sorted so that:
  Alice + Bob
  and
  Bob + Alice

  always resolve to the same conversation.
*/
const getOrCreateConversation = async (userId, otherUserId) => {
  const participants = [
    new mongoose.Types.ObjectId(userId),
    new mongoose.Types.ObjectId(otherUserId),
  ].sort((a, b) => a.toString().localeCompare(b.toString()));

  let conversation = await Conversation.findOne({
    participants: {
      $all: participants,
    },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants,
    });
  }

  return conversation;
};

/*
  Send message through REST.

  Socket.IO is used by the current chat UI for
  real-time message sending, but this controller
  remains available for REST-based sending.
*/
export const sendMessage = async (req, res) => {
  try {
    const { content, room, recipient, replyTo } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Message content is required",
      });
    }

    /*
      Public room message
    */
    if (!recipient) {
      let validReplyTo = null;

      if (replyTo) {
        if (!mongoose.Types.ObjectId.isValid(replyTo)) {
          return res.status(400).json({
            message: "Invalid reply message ID",
          });
        }

        const repliedMessage = await Message.findById(replyTo);

        if (repliedMessage && repliedMessage.room === (room || "general")) {
          validReplyTo = repliedMessage._id;
        }
      }

      const message = await Message.create({
        sender: req.user.userId,
        recipient: null,
        content: content.trim(),
        room: room || "general",
        senderUsername: req.user.username || "",
        replyTo: validReplyTo,
      });

      await message.populate("sender", "username displayName profilePicture");

      if (message.replyTo) {
        await message.populate({
          path: "replyTo",
          select: "content sender senderUsername createdAt room",
          populate: {
            path: "sender",
            select: "username displayName profilePicture",
          },
        });
      }

      return res.status(201).json({
        message: "Message sent successfully",
        data: message,
      });
    }

    /*
      DM validation
    */
    if (!mongoose.Types.ObjectId.isValid(recipient)) {
      return res.status(400).json({
        message: "Invalid recipient ID",
      });
    }

    if (recipient === req.user.userId) {
      return res.status(400).json({
        message: "You cannot message yourself",
      });
    }

    const recipientUser = await User.findById(recipient);

    if (!recipientUser || recipientUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /*
      Privacy rule:
      Only friends can send DMs.
    */
    const friendship = await Friendship.findOne({
      status: "accepted",
      $or: [
        {
          requester: req.user.userId,
          recipient,
        },
        {
          requester: recipient,
          recipient: req.user.userId,
        },
      ],
    });

    if (!friendship) {
      return res.status(403).json({
        message: "You can only message your friends",
      });
    }

    /*
      Make sure the DM conversation exists.

      The conversation remains even if every message
      is later unsent.
    */
    const conversation = await getOrCreateConversation(
      req.user.userId,
      recipient,
    );

    /*
      Validate reply target if provided.
    */
    let validReplyTo = null;

    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({
          message: "Invalid reply message ID",
        });
      }

      const repliedMessage = await Message.findById(replyTo);

      if (repliedMessage) {
        const belongsToConversation =
          (String(repliedMessage.sender) === String(req.user.userId) &&
            String(repliedMessage.recipient) === String(recipient)) ||
          (String(repliedMessage.sender) === String(recipient) &&
            String(repliedMessage.recipient) === String(req.user.userId));

        if (belongsToConversation) {
          validReplyTo = repliedMessage._id;
        }
      }
    }

    const message = await Message.create({
      sender: req.user.userId,
      recipient,
      content: content.trim(),
      room: null,
      senderUsername: req.user.username || "",
      replyTo: validReplyTo,
    });

    await message.populate("sender", "username displayName profilePicture");

    await message.populate("recipient", "username displayName profilePicture");

    if (message.replyTo) {
      await message.populate({
        path: "replyTo",
        select: "content sender senderUsername createdAt",
        populate: {
          path: "sender",
          select: "username displayName profilePicture",
        },
      });
    }

    /*
      Keep conversation metadata synchronized.
    */
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;

    await conversation.save();

    res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Message error:", error);

    res.status(500).json({
      message: "Failed to send message",
    });
  }
};

/*
  Get public room messages.
*/
export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      room: "general",
      recipient: null,
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username displayName profilePicture")
      .populate({
        path: "replyTo",
        select: "content sender senderUsername createdAt room",
        populate: {
          path: "sender",
          select: "username displayName profilePicture",
        },
      });

    res.status(200).json({
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    res.status(500).json({
      message: "Failed to fetch messages",
    });
  }
};

/*
  Get DM conversation with another user.

  Friendship is NOT required.

  Existing conversation history remains accessible
  after unfriending.
*/
export const getDirectMessages = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    if (currentUserId === otherUserId) {
      return res.status(400).json({
        message: "Invalid conversation",
      });
    }

    const otherUser = await User.findById(otherUserId);

    if (!otherUser || otherUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /*
      Friendship is only required for sending
      new messages.
    */
    const messages = await Message.find({
      room: null,
      $or: [
        {
          sender: currentUserId,
          recipient: otherUserId,
        },
        {
          sender: otherUserId,
          recipient: currentUserId,
        },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username displayName profilePicture")
      .populate("recipient", "username displayName profilePicture")
      .populate({
        path: "replyTo",
        select: "content sender senderUsername createdAt",
        populate: {
          path: "sender",
          select: "username displayName profilePicture",
        },
      });

    res.status(200).json({
      messages,
    });
  } catch (error) {
    console.error("Get direct messages error:", error);

    res.status(500).json({
      message: "Failed to fetch direct messages",
    });
  }
};

/*
  Get users with existing DM conversations.

  This reads from Conversation instead of Message.

  Therefore, unsending the last message does NOT
  remove the conversation from the sidebar.
*/
export const getDirectConversations = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .sort({ updatedAt: -1 })
      .populate(
        "participants",
        "username displayName email isDeleted profilePicture",
      );

    const result = [];

    for (const conversation of conversations) {
      const otherUser = conversation.participants.find(
        (participant) => String(participant._id) !== String(currentUserId),
      );

      if (!otherUser || otherUser.isDeleted) {
        continue;
      }

      result.push({
        _id: otherUser._id,
        username: otherUser.username,
        displayName: otherUser.displayName,
        email: otherUser.email,
        profilePicture: otherUser.profilePicture || "",
      });
    }

    res.status(200).json({
      conversations: result,
    });
  } catch (error) {
    console.error("Get direct conversations error:", error);

    res.status(500).json({
      message: "Failed to fetch direct conversations",
    });
  }
};

/*
  Edit a message.

  Only the original sender can edit
  their own message.
*/
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        message: "Invalid message ID",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Message content is required",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    /*
      Only the original sender can edit
      their own messages.
    */
    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({
        message: "You can only edit your own messages",
      });
    }

    message.content = content.trim();
    message.isEdited = true;

    await message.save();

    const emitToUser = req.app.get("emitToUser");
    const io = req.app.get("io");

    const messageData = {
      messageId: message._id.toString(),
      content: message.content,
      isEdited: message.isEdited,
    };

    /*
      DM message
    */
    if (message.recipient && emitToUser) {
      emitToUser(message.sender.toString(), "message_edited", messageData);

      emitToUser(message.recipient.toString(), "message_edited", messageData);
    }

    /*
      Public room message.
    */
    if (message.room && io) {
      io.emit("message_edited", messageData);
    }

    res.status(200).json({
      message: "Message edited successfully",
      data: message,
    });
  } catch (error) {
    console.error("Edit message error:", error);

    res.status(500).json({
      message: "Failed to edit message",
    });
  }
};

/*
  Unsend a message.

  Only the original sender can unsend
  their own message.

  IMPORTANT:

  The message is deleted first, but all information
  required for the Socket.IO event is saved before
  deletion.

  server.js tracks sockets by user ID through
  emitToUser(), so we use that same mechanism here.
*/
export const unsendMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        message: "Invalid message ID",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    /*
      Only the original sender can unsend
      their own message.
    */
    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({
        message: "You can only unsend your own messages",
      });
    }

    /*
      Save all information needed for the
      real-time event BEFORE deleting the message.
    */
    const messageData = {
      messageId: message._id.toString(),
      sender: message.sender.toString(),
      recipient: message.recipient ? message.recipient.toString() : null,
      room: message.room || null,
    };

    /*
      Delete the message from MongoDB.
    */
    await Message.findByIdAndDelete(messageId);

    /*
      Get the Socket.IO user-targeting helper
      registered by server.js.
    */
    const emitToUser = req.app.get("emitToUser");
    const io = req.app.get("io");

    /*
      DM message
    */
    if (messageData.recipient && emitToUser) {
      emitToUser(messageData.recipient, "message_unsent", {
        messageId: messageData.messageId,
      });

      emitToUser(messageData.sender, "message_unsent", {
        messageId: messageData.messageId,
      });
    }

    /*
      Public room message.

      Notify everyone connected to Chime.
    */
    if (messageData.room && io) {
      io.emit("message_unsent", {
        messageId: messageData.messageId,
      });
    }

    res.status(200).json({
      message: "Message unsent successfully",
      messageId: messageData.messageId,
    });
  } catch (error) {
    console.error("Unsend message error:", error);

    res.status(500).json({
      message: "Failed to unsend message",
    });
  }
};
