import express from "express";

import {
  sendMessage,
  getDirectMessages,
  getDirectConversations,
  getClusterMessages,
  unsendMessage,
  editMessage,
} from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/dms", authMiddleware, getDirectConversations);

router.get("/dm/:userId", authMiddleware, getDirectMessages);

router.get("/cluster/:clusterId", authMiddleware, getClusterMessages);

router.post("/", authMiddleware, sendMessage);

router.patch("/:messageId", authMiddleware, editMessage);

router.delete("/:messageId", authMiddleware, unsendMessage);

export default router;
