import Notification from "../models/Notification.js";

const notificationActorFields = "username displayName profilePicture";

export const createNotification = async ({
  recipient,
  type,
  actor = null,
  target = null,
  targetType = null,
  reference = null,
  emitToUser = null,
}) => {
  const notification = await Notification.create({
    recipient,
    type,
    actor,
    target,
    targetType,
    reference,
  });

  await notification.populate("actor", notificationActorFields);

  const notificationData = notification.toObject();

  if (typeof emitToUser === "function") {
    emitToUser(String(recipient), "notification_received", notificationData);
  }

  return notification;
};

export const deleteNotification = async ({
  recipient,
  type,
  target = null,
  targetType = null,
  emitToUser = null,
}) => {
  const query = {
    recipient,
    type,
  };

  if (target) {
    query.target = target;
  }

  if (targetType) {
    query.targetType = targetType;
  }

  const notification = await Notification.findOneAndDelete(query);

  if (!notification) {
    return null;
  }

  if (typeof emitToUser === "function") {
    emitToUser(String(recipient), "notification_deleted", {
      notificationId: String(notification._id),
    });
  }

  return notification;
};

export const deleteNotifications = async ({
  recipient,
  type,
  target = null,
  targetType = null,
  emitToUser = null,
}) => {
  const query = {
    recipient,
    type,
  };

  if (target) {
    query.target = target;
  }

  if (targetType) {
    query.targetType = targetType;
  }

  const notifications = await Notification.find(query).select("_id");

  if (notifications.length === 0) {
    return [];
  }

  await Notification.deleteMany(query);

  if (typeof emitToUser === "function") {
    notifications.forEach((notification) => {
      emitToUser(String(recipient), "notification_deleted", {
        notificationId: String(notification._id),
      });
    });
  }

  return notifications;
};
