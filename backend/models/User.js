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

    // Cloudinary profile picture URL
    profilePicture: {
      type: String,
      default: "",
    },

    // Cloudinary public ID used to replace/delete the image later
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
      required: true,
    },

    /*
      User's manually selected presence status.

      online:
      User wants to appear online.
      They will only actually appear online to others
      while they have an active Socket.IO connection.

      away:
      User wants to appear away while connected.

      invisible:
      User appears offline to everyone else even
      while they are connected.
    */
    status: {
      type: String,
      enum: ["online", "away", "invisible"],
      default: "online",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Accepted friends
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Friend requests sent by this user
    friendRequestsSent: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Friend requests received by this user
    friendRequestsReceived: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;
