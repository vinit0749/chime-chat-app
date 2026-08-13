import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";

export const sendMessage = async (req, res) => {
  try {
    const { content, room, recipient } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Message content is required",
      });
    }

    /*
      Public room message
    */
    if (!recipient) {
      const message = await Message.create({
        sender: req.user.userId,
        recipient: null,
        content: content.trim(),
        room: room || "general",
        senderUsername: req.user.username || "",
      });

      await message.populate("sender", "username");

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

    const message = await Message.create({
      sender: req.user.userId,
      recipient,
      content: content.trim(),
      room: null,
      senderUsername: req.user.username || "",
    });

    await message.populate("sender", "username");
    await message.populate("recipient", "username");

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

export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      room: "general",
      recipient: null,
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username");

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
  Get DM conversation with another user
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
      DM history can be viewed even if the users
      are no longer friends.

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
      .populate("sender", "username")
      .populate("recipient", "username");

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
  Get users with existing DM conversations
*/
export const getDirectConversations = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const messages = await Message.find({
      room: null,
      $or: [
        {
          sender: currentUserId,
          recipient: { $ne: null },
        },
        {
          recipient: currentUserId,
          sender: { $ne: null },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username email isDeleted")
      .populate("recipient", "username email isDeleted");

    const conversations = [];
    const seenUsers = new Set();

    for (const message of messages) {
      const otherUser =
        message.sender?._id.toString() === currentUserId
          ? message.recipient
          : message.sender;

      if (!otherUser || otherUser.isDeleted) {
        continue;
      }

      const otherUserId = otherUser._id.toString();

      if (seenUsers.has(otherUserId)) {
        continue;
      }

      seenUsers.add(otherUserId);

      conversations.push({
        _id: otherUser._id,
        username: otherUser.username,
        email: otherUser.email,
      });
    }

    res.status(200).json({
      conversations,
    });
  } catch (error) {
    console.error("Get direct conversations error:", error);

    res.status(500).json({
      message: "Failed to fetch direct conversations",
    });
  }
};
