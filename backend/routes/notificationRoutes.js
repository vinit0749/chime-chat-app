import express from "express";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  updateNotificationAction,
  deleteNotification,
  deleteAllNotifications,
} from "../controllers/notificationController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getNotifications);

router.get("/unread-count", authMiddleware, getUnreadNotificationCount);

router.patch("/:notificationId/read", authMiddleware, markNotificationRead);

router.patch("/read-all", authMiddleware, markAllNotificationsRead);

router.patch(
  "/:notificationId/action",
  authMiddleware,
  updateNotificationAction,
);

router.delete("/all", authMiddleware, deleteAllNotifications);

router.delete("/:notificationId", authMiddleware, deleteNotification);

export default router;
