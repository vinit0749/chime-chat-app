import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Cluster from "../models/Cluster.js";
import ClusterMember from "../models/ClusterMember.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Notification from "../models/Notification.js";
import Friendship from "../models/Friendship.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      return callback(new Error("Unsupported image type"));
    }

    callback(null, true);
  },
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "username displayName bio profilePicture status pinnedDMs pinnedClusters",
    );

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

router.put("/me", authMiddleware, async (req, res) => {
  try {
    const { username, displayName, bio, status } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const previousStatus = user.status;

    if (username !== undefined) {
      const normalizedUsername = username.trim().toLowerCase();

      if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
        return res.status(400).json({
          message:
            "Username must be 3-20 characters and contain only letters, numbers, and underscores",
        });
      }

      if (normalizedUsername !== user.username) {
        const existingUser = await User.findOne({
          username: normalizedUsername,
          _id: { $ne: user._id },
        });

        if (existingUser) {
          return res.status(409).json({
            message: "Username is already taken",
          });
        }

        user.username = normalizedUsername;
      }
    }

    if (displayName !== undefined) {
      user.displayName = displayName.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (status !== undefined) {
      if (!["online", "away", "invisible"].includes(status)) {
        return res.status(400).json({
          message: "Invalid status",
        });
      }

      user.status = status;
    }

    await user.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("user_profile_updated", {
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          profilePicture: user.profilePicture || "",
          status: user.status,
        },
      });
    }

    if (status !== undefined && previousStatus !== user.status) {
      const io = req.app.get("io");

      if (io) {
        const sockets = io.sockets.sockets;

        const isConnected = [...sockets.values()].some(
          (socket) => socket.user?.userId === user._id.toString(),
        );

        let effectiveStatus = "offline";

        if (isConnected && user.status !== "invisible") {
          effectiveStatus = user.status || "online";
        }

        io.emit("presence_update", {
          userId: user._id.toString(),
          status: effectiveStatus,
        });
      }
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        profilePicture: user.profilePicture || "",
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

router.put(
  "/me/profile-picture",
  authMiddleware,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No profile picture provided",
        });
      }

      const user = await User.findById(req.user.userId);

      if (!user || user.isDeleted) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      if (user.profilePicturePublicId) {
        try {
          await cloudinary.uploader.destroy(user.profilePicturePublicId);
        } catch (error) {
          console.error("Failed to delete previous profile picture:", error);
        }
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "chime/profile-pictures",
            resource_type: "image",
            transformation: [
              {
                width: 800,
                height: 800,
                crop: "fill",
                gravity: "face",
                quality: "auto",
                fetch_format: "auto",
              },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        );

        uploadStream.end(req.file.buffer);
      });

      user.profilePicture = uploadResult.secure_url;
      user.profilePicturePublicId = uploadResult.public_id;

      await user.save();

      const io = req.app.get("io");

      if (io) {
        io.emit("user_profile_updated", {
          user: {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            profilePicture: user.profilePicture || "",
            status: user.status,
          },
        });
      }

      res.json({
        message: "Profile picture updated successfully",
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profilePicture: user.profilePicture,
          status: user.status,
        },
      });
    } catch (error) {
      console.error("Profile picture upload error:", error);

      res.status(500).json({
        message: "Failed to upload profile picture",
      });
    }
  },
);

router.delete("/me/profile-picture", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.profilePicturePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicturePublicId);
      } catch (error) {
        console.error("Failed to delete profile picture:", error);
      }
    }

    user.profilePicture = "";
    user.profilePicturePublicId = "";

    await user.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("user_profile_updated", {
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          profilePicture: "",
          status: user.status,
        },
      });
    }

    return res.json({
      message: "Profile picture removed successfully",
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        profilePicture: "",
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Remove profile picture error:", error);

    return res.status(500).json({
      message: "Failed to remove profile picture",
    });
  }
});

router.post("/pins/dm/:userId", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const currentUser = await User.findById(req.user.userId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const targetUser = await User.findById(req.params.userId);

    if (!targetUser || targetUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (String(targetUser._id) === String(currentUser._id)) {
      return res.status(400).json({
        message: "You cannot pin yourself",
      });
    }

    const isBlocked =
      (currentUser.blockedUsers || []).some(
        (blockedId) => String(blockedId) === String(targetUser._id),
      ) ||
      (targetUser.blockedUsers || []).some(
        (blockedId) => String(blockedId) === String(currentUser._id),
      );

    if (isBlocked) {
      return res.status(403).json({
        message: "You cannot pin this conversation",
      });
    }

    if (
      !currentUser.friends.some((id) => String(id) === String(targetUser._id))
    ) {
      return res.status(403).json({
        message: "You can only pin conversations with friends",
      });
    }

    if (
      !currentUser.pinnedDMs.some((id) => String(id) === String(targetUser._id))
    ) {
      currentUser.pinnedDMs.push(targetUser._id);
      await currentUser.save();
    }

    const io = req.app.get("io");

    if (io) {
      io.to(`user:${currentUser._id}`).emit("conversation_pin_updated", {
        type: "dm",
        targetId: String(targetUser._id),
        pinned: true,
      });
    }

    return res.status(200).json({
      message: "Conversation pinned",
      type: "dm",
      targetId: String(targetUser._id),
      pinned: true,
    });
  } catch (error) {
    console.error("Pin DM error:", error);

    return res.status(500).json({
      message: "Failed to pin conversation",
    });
  }
});

router.delete("/pins/dm/:userId", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const currentUser = await User.findById(req.user.userId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    currentUser.pinnedDMs = currentUser.pinnedDMs.filter(
      (id) => String(id) !== String(req.params.userId),
    );

    await currentUser.save();

    const io = req.app.get("io");

    if (io) {
      io.to(`user:${currentUser._id}`).emit("conversation_pin_updated", {
        type: "dm",
        targetId: String(req.params.userId),
        pinned: false,
      });
    }

    return res.status(200).json({
      message: "Conversation unpinned",
      type: "dm",
      targetId: String(req.params.userId),
      pinned: false,
    });
  } catch (error) {
    console.error("Unpin DM error:", error);

    return res.status(500).json({
      message: "Failed to unpin conversation",
    });
  }
});

router.post("/pins/cluster/:clusterId", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.clusterId)) {
      return res.status(400).json({
        message: "Invalid cluster ID",
      });
    }

    const currentUser = await User.findById(req.user.userId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const cluster = await Cluster.findById(req.params.clusterId);

    if (!cluster || cluster.isDeleted) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const membership = await ClusterMember.findOne({
      cluster: cluster._id,
      user: currentUser._id,
      status: "active",
    });

    if (!membership) {
      return res.status(403).json({
        message: "You must be a Cluster member to pin it",
      });
    }

    if (
      !currentUser.pinnedClusters.some(
        (id) => String(id) === String(cluster._id),
      )
    ) {
      currentUser.pinnedClusters.push(cluster._id);
      await currentUser.save();
    }

    const io = req.app.get("io");

    if (io) {
      io.to(`user:${currentUser._id}`).emit("conversation_pin_updated", {
        type: "cluster",
        targetId: String(cluster._id),
        pinned: true,
      });
    }

    return res.status(200).json({
      message: "Cluster pinned",
      type: "cluster",
      targetId: String(cluster._id),
      pinned: true,
    });
  } catch (error) {
    console.error("Pin Cluster error:", error);

    return res.status(500).json({
      message: "Failed to pin Cluster",
    });
  }
});

router.delete("/pins/cluster/:clusterId", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.clusterId)) {
      return res.status(400).json({
        message: "Invalid cluster ID",
      });
    }

    const currentUser = await User.findById(req.user.userId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    currentUser.pinnedClusters = currentUser.pinnedClusters.filter(
      (id) => String(id) !== String(req.params.clusterId),
    );

    await currentUser.save();

    const io = req.app.get("io");

    if (io) {
      io.to(`user:${currentUser._id}`).emit("conversation_pin_updated", {
        type: "cluster",
        targetId: String(req.params.clusterId),
        pinned: false,
      });
    }

    return res.status(200).json({
      message: "Cluster unpinned",
      type: "cluster",
      targetId: String(req.params.clusterId),
      pinned: false,
    });
  } catch (error) {
    console.error("Unpin Cluster error:", error);

    return res.status(500).json({
      message: "Failed to unpin Cluster",
    });
  }
});

router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.json({
        users: [],
      });
    }

    const currentUser = await User.findById(req.user.userId).select(
      "friends friendRequestsSent friendRequestsReceived isDeleted",
    );

    if (!currentUser || currentUser.isDeleted) {
      return res.status(401).json({
        message: "User account not found",
      });
    }

    const users = await User.find({
      _id: {
        $ne: req.user.userId,
      },
      isDeleted: false,
      username: {
        $regex: query,
        $options: "i",
      },
    })
      .select("username displayName profilePicture status")
      .limit(10);

    const results = users.map((user) => {
      let relationshipStatus = "none";

      if (currentUser.friends.includes(user._id)) {
        relationshipStatus = "friends";
      } else if (currentUser.friendRequestsSent.includes(user._id)) {
        relationshipStatus = "sent";
      } else if (currentUser.friendRequestsReceived.includes(user._id)) {
        relationshipStatus = "received";
      }

      return {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        profilePicture: user.profilePicture || "",
        status: user.status,
        relationshipStatus,
      };
    });

    res.json({
      users: results,
    });
  } catch (error) {
    console.error("Search users error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }
    const currentUser = await User.findById(req.user.userId).select(
      "friends friendRequestsSent friendRequestsReceived blockedUsers isDeleted",
    );

    if (!currentUser || currentUser.isDeleted) {
      return res.status(401).json({
        message: "User account not found",
      });
    }

    const user = await User.findById(req.params.userId).select(
      "username displayName bio profilePicture status isDeleted",
    );

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const targetUserId = user._id.toString();

    const isBlocked =
      currentUser.blockedUsers?.some(
        (blockedId) => blockedId.toString() === targetUserId,
      ) || false;

    let relationshipStatus = "none";

    if (isBlocked) {
      relationshipStatus = "blocked";
    } else if (
      currentUser.friends.some(
        (friendId) => friendId.toString() === targetUserId,
      )
    ) {
      relationshipStatus = "friends";
    } else if (
      currentUser.friendRequestsSent.some(
        (requestId) => requestId.toString() === targetUserId,
      )
    ) {
      relationshipStatus = "sent";
    } else if (
      currentUser.friendRequestsReceived.some(
        (requestId) => requestId.toString() === targetUserId,
      )
    ) {
      relationshipStatus = "received";
    }

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        profilePicture: user.profilePicture || "",
        status: user.status,
        isFriend: relationshipStatus === "friends",
        relationshipStatus,
      },
    });
  } catch (error) {
    console.error("Get public profile error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const userId = user._id;

    const ownedClusters = await Cluster.find({
      owner: userId,
    }).select("_id profilePicturePublicId");

    const ownedClusterIds = ownedClusters.map((cluster) => cluster._id);

    if (user.profilePicturePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicturePublicId);
      } catch (error) {
        console.error(
          "Failed to delete user profile picture from Cloudinary:",
          error,
        );
      }
    }

    for (const cluster of ownedClusters) {
      if (cluster.profilePicturePublicId) {
        try {
          await cloudinary.uploader.destroy(cluster.profilePicturePublicId);
        } catch (error) {
          console.error(
            `Failed to delete Cluster profile picture ${cluster._id}:`,
            error,
          );
        }
      }
    }

    if (ownedClusterIds.length > 0) {
      const io = req.app.get("io");

      if (io) {
        for (const clusterId of ownedClusterIds) {
          io.to(`cluster:${String(clusterId)}`).emit("cluster_deleted", {
            clusterId: String(clusterId),
          });
        }
      }

      await Message.deleteMany({
        cluster: { $in: ownedClusterIds },
      });

      await ClusterMember.deleteMany({
        cluster: { $in: ownedClusterIds },
      });

      await Notification.deleteMany({
        targetType: "Cluster",
        target: { $in: ownedClusterIds },
      });

      await User.updateMany(
        {
          pinnedClusters: { $in: ownedClusterIds },
        },
        {
          $pull: {
            pinnedClusters: { $in: ownedClusterIds },
          },
        },
      );

      await Cluster.deleteMany({
        _id: { $in: ownedClusterIds },
      });
    }

    await Message.deleteMany({
      $or: [{ sender: userId }, { recipient: userId }],
    });

    await Conversation.deleteMany({
      participants: userId,
    });

    await ClusterMember.deleteMany({
      user: userId,
    });

    await Friendship.deleteMany({
      $or: [{ requester: userId }, { recipient: userId }],
    });

    await Notification.deleteMany({
      $or: [
        { recipient: userId },
        { actor: userId },
        {
          targetType: "User",
          target: userId,
        },
      ],
    });

    await User.updateMany(
      {
        $or: [
          { friends: userId },
          { friendRequestsSent: userId },
          { friendRequestsReceived: userId },
          { blockedUsers: userId },
          { pinnedDMs: userId },
        ],
      },
      {
        $pull: {
          friends: userId,
          friendRequestsSent: userId,
          friendRequestsReceived: userId,
          blockedUsers: userId,
          pinnedDMs: userId,
        },
      },
    );

    const io = req.app.get("io");

    if (io) {
      io.emit("presence_update", {
        userId: String(userId),
        status: "offline",
      });

      io.emit("user_deleted", {
        userId: String(userId),
      });

      io.in(`user:${String(userId)}`).disconnectSockets(true);
    }

    await User.deleteOne({
      _id: userId,
    });

    return res.json({
      message: "Account deleted permanently",
    });
  } catch (error) {
    console.error("Delete account error:", error);

    return res.status(500).json({
      message: "Failed to delete account",
    });
  }
});

export default router;
