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

    /*
      DM recipient.

      Used only for direct messages.
      Cluster messages have recipient = null.
    */
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /*
      Cluster this message belongs to.

      Used only for Cluster messages.
      DM messages have cluster = null.
    */
    cluster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cluster",
      default: null,
    },

    /*
      Message type.

      text:
      Normal chat message.

      cluster_invite:
      Invitation to join a private Cluster.
    */
    messageType: {
      type: String,
      enum: ["text", "cluster_invite"],
      default: "text",
      required: true,
    },

    /*
      Cluster invitation details.

      Used only when messageType is cluster_invite.
    */
    clusterInvite: {
      cluster: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cluster",
        default: null,
      },

      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
      },
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
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

      For Cluster messages, this will initially behave
      differently from DMs because multiple members can
      receive the message.
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

/*
  Helpful indexes for message retrieval.

  DM queries:
  sender + recipient

  Cluster queries:
  cluster + createdAt
*/
messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });
messageSchema.index({ cluster: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
