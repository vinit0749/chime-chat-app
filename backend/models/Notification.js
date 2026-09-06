import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "friend_request",
        "friend_request_accepted",
        "dm",
        "cluster_invitation",
        "cluster_join_request",
        "cluster_join_request_approved",
        "cluster_join_request_rejected",
        "cluster_ownership_transferred",
        "cluster_member_removed",
      ],
      required: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    target: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    targetType: {
      type: String,
      enum: ["User", "Conversation", "Cluster", null],
      default: null,
    },

    reference: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    read: {
      type: Boolean,
      default: false,
    },

    actionStatus: {
      type: String,
      enum: ["accepted", "declined", null],
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
