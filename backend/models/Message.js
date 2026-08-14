import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderUsername: {
      type: String,
      required: true,
      trim: true,
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    room: {
      type: String,
      default: null,
    },

    /*
      Optional reference to the message being replied to.
    */
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    /*
      Message status.

      sent      = saved by the server
      delivered = recipient received the message
      read      = recipient opened/read the conversation
    */
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    /*
      Whether the message has been edited.
    */
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
