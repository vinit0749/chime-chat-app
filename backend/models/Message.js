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

    cluster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cluster",
      default: null,
    },

    messageType: {
      type: String,
      enum: ["text", "cluster_invite", "system"],
      default: "text",
      required: true,
    },

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

    systemAction: {
      type: String,
      enum: [
        "cluster_created",
        "member_joined",
        "member_left",
        "member_removed",
        "ownership_transferred",
      ],
      default: null,
    },

    systemTarget: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      username: {
        type: String,
        default: "",
        trim: true,
      },
    },

    content: {
      type: String,
      trim: true,
      maxlength: 2000,
      required: function () {
        return this.messageType !== "system";
      },
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });
messageSchema.index({ cluster: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
