import express from "express";

import {
  sendMessage,
  getClusterMessages,
  getDirectMessages,
  markDirectConversationRead,
  getDirectConversations,
  editMessage,
  unsendMessage,
  clearDirectMessages,
  wipeClusterMessages,
  searchMessages,
} from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/dms", authMiddleware, getDirectConversations);

router.get("/search", authMiddleware, searchMessages);

router.get("/dm/:userId", authMiddleware, getDirectMessages);

router.patch("/dm/:userId/read", authMiddleware, markDirectConversationRead);

router.delete("/dm/:userId", authMiddleware, clearDirectMessages);

router.get("/cluster/:clusterId", authMiddleware, getClusterMessages);

router.delete("/cluster/:clusterId", authMiddleware, wipeClusterMessages);

router.post("/", authMiddleware, sendMessage);

router.patch("/:messageId", authMiddleware, editMessage);

router.delete("/:messageId", authMiddleware, unsendMessage);

export default router;
