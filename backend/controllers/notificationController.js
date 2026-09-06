import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Cluster from "../models/Cluster.js";
import Conversation from "../models/Conversation.js";

const actorFields = "username displayName profilePicture";

const buildNotificationData = async (notification) => {
  const data = notification.toObject();

  if (data.target && data.targetType === "User") {
    const targetUser = await User.findById(data.target).select(actorFields);

    data.target = targetUser
      ? {
          _id: targetUser._id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          profilePicture: targetUser.profilePicture || "",
        }
      : null;
  }

  if (data.target && data.targetType === "Cluster") {
    const targetCluster = await Cluster.findById(data.target).select(
      "name description profilePicture visibility owner",
    );

    data.target = targetCluster
      ? {
          _id: targetCluster._id,
          name: targetCluster.name,
          description: targetCluster.description,
          profilePicture: targetCluster.profilePicture || "",
          visibility: targetCluster.visibility,
          owner: targetCluster.owner,
        }
      : null;
  }

  if (data.target && data.targetType === "Conversation") {
    const conversation = await Conversation.findById(data.target).select(
      "participants",
    );

    data.target = conversation
      ? {
          _id: conversation._id,
          participants: conversation.participants,
        }
      : null;
  }

  return data;
};

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const notifications = await Notification.find({
      recipient: userId,
    })
      .sort({ createdAt: -1 })
      .populate("actor", actorFields);

    const data = await Promise.all(notifications.map(buildNotificationData));

    return res.status(200).json({
      notifications: data,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      message: "Failed to fetch notifications",
    });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    return res.status(200).json({
      unreadCount,
    });
  } catch (error) {
    console.error("Get notification unread count error:", error);

    return res.status(500).json({
      message: "Failed to fetch notification unread count",
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();
    }

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(userId), "notification_updated", {
        notificationId: String(notification._id),
        read: true,
      });
    }

    return res.status(200).json({
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);

    return res.status(500).json({
      message: "Failed to mark notification as read",
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    await Notification.updateMany(
      {
        recipient: userId,
        read: false,
      },
      {
        $set: {
          read: true,
        },
      },
    );

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(userId), "notifications_read_all");
    }

    return res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    return res.status(500).json({
      message: "Failed to mark all notifications as read",
    });
  }
};

export const updateNotificationAction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;
    const { actionStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        message: "Invalid notification ID",
      });
    }

    if (!["accepted", "declined"].includes(actionStatus)) {
      return res.status(400).json({
        message: "Invalid notification action",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: userId,
        type: "friend_request",
      },
      {
        $set: {
          actionStatus,
          read: true,
        },
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(userId), "notification_updated", {
        notificationId: String(notification._id),
        read: true,
        actionStatus,
      });
    }

    return res.status(200).json({
      message: "Notification updated",
      notification: {
        _id: notification._id,
        read: notification.read,
        actionStatus: notification.actionStatus,
      },
    });
  } catch (error) {
    console.error("Update notification action error:", error);

    return res.status(500).json({
      message: "Failed to update notification",
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(userId), "notification_deleted", {
        notificationId: String(notification._id),
      });
    }

    return res.status(200).json({
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete notification error:", error);

    return res.status(500).json({
      message: "Failed to delete notification",
    });
  }
};
