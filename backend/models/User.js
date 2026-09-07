import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    displayName: {
      type: String,
      trim: true,
      default: "",
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    profilePicture: {
      type: String,
      default: "",
    },

    profilePicturePublicId: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      default: null,
    },

    authProvider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },

    providerId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["online", "away", "invisible"],
      default: "online",
    },

    status: {
      type: String,
      enum: ["online", "away", "invisible"],
      default: "online",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    friendRequestsSent: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    friendRequestsReceived: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    pinnedDMs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    pinnedClusters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cluster",
      },
    ],
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;
