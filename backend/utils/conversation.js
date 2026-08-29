import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";

/*
  Get or create a DM conversation.

  The participant IDs are normalized and sorted so:

  Alice + Bob
  and
  Bob + Alice

  always resolve to the same conversation.

  This helper is shared by:
  - REST message controller
  - Socket.IO message handling
*/
const getOrCreateConversation = async (userId, otherUserId) => {
  const participants = [
    new mongoose.Types.ObjectId(userId),
    new mongoose.Types.ObjectId(otherUserId),
  ].sort((a, b) => a.toString().localeCompare(b.toString()));

  /*
    Find the existing two-person conversation.
  */
  let conversation = await Conversation.findOne({
    participants: {
      $all: participants,
      $size: 2,
    },
  });

  if (conversation) {
    return conversation;
  }

  /*
    Create the conversation.

    If two requests attempt to create the same
    conversation at exactly the same time, the
    second attempt may fail. In that case we
    fetch the conversation that the other request
    created.
  */
  try {
    conversation = await Conversation.create({
      participants,
    });

    return conversation;
  } catch (error) {
    conversation = await Conversation.findOne({
      participants: {
        $all: participants,
        $size: 2,
      },
    });

    if (conversation) {
      return conversation;
    }

    throw error;
  }
};

export default getOrCreateConversation;
