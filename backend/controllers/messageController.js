import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";
import Conversation from "../models/Conversation.js";
import Cluster from "../models/Cluster.js";
import ClusterMember from "../models/ClusterMember.js";
import getOrCreateConversation from "../utils/conversation.js";

export const sendMessage = async (req, res) => {
  try {
    const { content, recipient, cluster, replyTo } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Message content is required",
      });
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 2000) {
      return res.status(400).json({
        message: "Message content cannot exceed 2000 characters",
      });
    }

    if (recipient && cluster) {
      return res.status(400).json({
        message: "Message cannot have both a recipient and a cluster",
      });
    }

    if (!recipient && !cluster) {
      return res.status(400).json({
        message: "Message recipient or cluster is required",
      });
    }

    if (cluster) {
      if (!mongoose.Types.ObjectId.isValid(cluster)) {
        return res.status(400).json({
          message: "Invalid cluster ID",
        });
      }

      const clusterData = await Cluster.findById(cluster);

      if (!clusterData || clusterData.isDeleted) {
        return res.status(404).json({
          message: "Cluster not found",
        });
      }

      const membership = await ClusterMember.findOne({
        cluster,
        user: userId,
        status: "active",
      });

      if (!membership) {
        return res.status(403).json({
          message: "You must be an active Cluster member to send messages",
        });
      }

      let validReplyTo = null;

      if (replyTo) {
        if (!mongoose.Types.ObjectId.isValid(replyTo)) {
          return res.status(400).json({
            message: "Invalid reply message ID",
          });
        }

        const repliedMessage = await Message.findOne({
          _id: replyTo,
          cluster,
        });

        if (repliedMessage) {
          validReplyTo = repliedMessage._id;
        }
      }

      const message = await Message.create({
        sender: userId,
        senderUsername: req.user.username || "",
        recipient: null,
        cluster,
        content: trimmedContent,
        replyTo: validReplyTo,
        status: "delivered",
      });

      await message.populate("sender", "username displayName profilePicture");

      await message.populate("cluster", "name description visibility owner");

      if (message.replyTo) {
        await message.populate({
          path: "replyTo",
          select: "content sender senderUsername createdAt cluster",
          populate: {
            path: "sender",
            select: "username displayName profilePicture",
          },
        });
      }

      const emitToUser = req.app.get("emitToUser");

      if (emitToUser) {
        const members = await ClusterMember.find({
          cluster,
          status: "active",
        }).select("user");

        for (const member of members) {
          emitToUser(member.user.toString(), "new_cluster_message", {
            clusterId: String(cluster),
            message,
          });
        }
      }

      return res.status(201).json({
        message: "Message sent successfully",
        data: message,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(recipient)) {
      return res.status(400).json({
        message: "Invalid recipient ID",
      });
    }

    if (String(recipient) === String(userId)) {
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

    const friendship = await Friendship.findOne({
      status: "accepted",
      $or: [
        {
          requester: userId,
          recipient,
        },
        {
          requester: recipient,
          recipient: userId,
        },
      ],
    });

    if (!friendship) {
      return res.status(403).json({
        message: "You can only message your friends",
      });
    }

    const conversation = await getOrCreateConversation(userId, recipient);

    let validReplyTo = null;

    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({
          message: "Invalid reply message ID",
        });
      }

      const repliedMessage = await Message.findOne({
        _id: replyTo,
        $or: [
          {
            sender: userId,
            recipient,
          },
          {
            sender: recipient,
            recipient: userId,
          },
        ],
        cluster: null,
      });

      if (repliedMessage) {
        validReplyTo = repliedMessage._id;
      }
    }

    const message = await Message.create({
      sender: userId,
      senderUsername: req.user.username || "",
      recipient,
      cluster: null,
      content: trimmedContent,
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

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;

    await conversation.save();

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Message error:", error);

    return res.status(500).json({
      message: "Failed to send message",
    });
  }
};

export const getClusterMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { clusterId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(clusterId)) {
      return res.status(400).json({
        message: "Invalid cluster ID",
      });
    }

    const cluster = await Cluster.findById(clusterId);

    if (!cluster || cluster.isDeleted) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const membership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "active",
    });

    if (!membership) {
      return res.status(403).json({
        message: "You must be an active Cluster member to view messages",
      });
    }

    const messages = await Message.find({
      cluster: clusterId,
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username displayName profilePicture")
      .populate("cluster", "name description visibility owner")
      .populate({
        path: "replyTo",
        select: "content sender senderUsername createdAt cluster",
        populate: {
          path: "sender",
          select: "username displayName profilePicture",
        },
      });

    return res.status(200).json({
      messages,
    });
  } catch (error) {
    console.error("Get cluster messages error:", error);

    return res.status(500).json({
      message: "Failed to fetch cluster messages",
    });
  }
};

export const getDirectMessages = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    if (String(currentUserId) === String(otherUserId)) {
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

    const messages = await Message.find({
      cluster: null,
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
        path: "clusterInvite.cluster",
        select: "name description profilePicture visibility owner",
      })
      .populate({
        path: "replyTo",
        select: "content sender senderUsername createdAt",
        populate: {
          path: "sender",
          select: "username displayName profilePicture",
        },
      });

    return res.status(200).json({
      messages,
    });
  } catch (error) {
    console.error("Get direct messages error:", error);

    return res.status(500).json({
      message: "Failed to fetch direct messages",
    });
  }
};

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

    return res.status(200).json({
      conversations: result,
    });
  } catch (error) {
    console.error("Get direct conversations error:", error);

    return res.status(500).json({
      message: "Failed to fetch direct conversations",
    });
  }
};

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

    const trimmedContent = content.trim();

    if (trimmedContent.length > 2000) {
      return res.status(400).json({
        message: "Message content cannot exceed 2000 characters",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({
        message: "You can only edit your own messages",
      });
    }

    message.content = trimmedContent;
    message.isEdited = true;

    await message.save();

    const messageData = {
      messageId: message._id.toString(),
      content: message.content,
      isEdited: message.isEdited,
      updatedAt: message.updatedAt,
    };

    const emitToUser = req.app.get("emitToUser");

    if (message.recipient && emitToUser) {
      emitToUser(message.sender.toString(), "message_edited", messageData);
      emitToUser(message.recipient.toString(), "message_edited", messageData);
    }

    if (message.cluster && emitToUser) {
      const members = await ClusterMember.find({
        cluster: message.cluster,
        status: "active",
      }).select("user");

      for (const member of members) {
        emitToUser(member.user.toString(), "message_edited", messageData);
      }
    }

    return res.status(200).json({
      message: "Message edited successfully",
      data: message,
    });
  } catch (error) {
    console.error("Edit message error:", error);

    return res.status(500).json({
      message: "Failed to edit message",
    });
  }
};

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

    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({
        message: "You can only unsend your own messages",
      });
    }

    const messageData = {
      messageId: message._id.toString(),
      sender: message.sender.toString(),
      recipient: message.recipient ? message.recipient.toString() : null,
      cluster: message.cluster ? message.cluster.toString() : null,
    };

    await Message.findByIdAndDelete(messageId);

    const emitToUser = req.app.get("emitToUser");

    if (messageData.recipient && emitToUser) {
      emitToUser(messageData.recipient, "message_unsent", {
        messageId: messageData.messageId,
      });

      emitToUser(messageData.sender, "message_unsent", {
        messageId: messageData.messageId,
      });
    }

    if (messageData.cluster && emitToUser) {
      const members = await ClusterMember.find({
        cluster: messageData.cluster,
        status: "active",
      }).select("user");

      for (const member of members) {
        emitToUser(member.user.toString(), "message_unsent", {
          messageId: messageData.messageId,
        });
      }
    }

    return res.status(200).json({
      message: "Message unsent successfully",
      messageId: messageData.messageId,
    });
  } catch (error) {
    console.error("Unsend message error:", error);

    return res.status(500).json({
      message: "Failed to unsend message",
    });
  }
};
