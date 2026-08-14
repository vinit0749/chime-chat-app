import express from "express";
import {
  sendMessage,
  getMessages,
  getDirectMessages,
  getDirectConversations,
  unsendMessage,
  editMessage,
} from "../controllers/messageController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/*
  Get public room messages
*/
router.get("/", authMiddleware, getMessages);

/*
  Get existing DM conversations

  IMPORTANT:
  This is separate from the friends list.
  Conversations remain visible even after
  unfriending.
*/
router.get("/dms", authMiddleware, getDirectConversations);

/*
  Get DM conversation with another user

  Friendship is NOT required here because
  old conversation history should remain accessible.
*/
router.get("/dm/:userId", authMiddleware, getDirectMessages);

/*
  Send message through REST

  messageController checks friendship before
  allowing a DM to be sent.
*/
router.post("/", authMiddleware, sendMessage);

/*
  Edit a message

  Only the original sender can edit
  their own message.
*/
router.patch("/:messageId", authMiddleware, editMessage);

/*
  Unsend a message

  Only the original sender is allowed
  to unsend their own message.
*/
router.delete("/:messageId", authMiddleware, unsendMessage);

export default router;
