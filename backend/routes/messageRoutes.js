import express from "express";

import {
  sendMessage,
  getDirectMessages,
  getDirectConversations,
  getClusterMessages,
  unsendMessage,
  editMessage,
  clearDirectMessages,
  markDirectConversationRead,
  wipeClusterMessages,
} from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/dms", authMiddleware, getDirectConversations);

router.get("/dm/:userId", authMiddleware, getDirectMessages);

router.patch("/dm/:userId/read", authMiddleware, markDirectConversationRead);

router.delete("/dm/:userId", authMiddleware, clearDirectMessages);

router.get("/cluster/:clusterId", authMiddleware, getClusterMessages);

router.delete("/cluster/:clusterId", authMiddleware, wipeClusterMessages);

router.post("/", authMiddleware, sendMessage);

router.patch("/:messageId", authMiddleware, editMessage);

router.delete("/:messageId", authMiddleware, unsendMessage);

export default router;
