import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

/*
  Multer configuration

  Images are kept in memory temporarily and then
  uploaded directly to Cloudinary.
*/
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/*
  Get current user's profile
*/
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "username displayName bio profilePicture status",
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

/*
  Update current user's profile
*/
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const { username, displayName, bio, status } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /*
      Track whether the presence status actually changed.
    */
    const previousStatus = user.status;

    /*
      Username
    */
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

    /*
      Display name
    */
    if (displayName !== undefined) {
      user.displayName = displayName.trim();
    }

    /*
      Bio
    */
    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    /*
      Manually selected presence status.
    */
    if (status !== undefined) {
      if (!["online", "away", "invisible"].includes(status)) {
        return res.status(400).json({
          message: "Invalid status",
        });
      }

      user.status = status;
    }

    await user.save();

    /*
      Broadcast the status change immediately.

      server.js exposes the Socket.IO instance through:
      app.set("io", io)

      This lets REST profile updates notify all connected
      clients immediately without requiring a refresh.
    */
    if (status !== undefined && previousStatus !== user.status) {
      const io = req.app.get("io");

      if (io) {
        const sockets = io.sockets.sockets;

        /*
          Check whether this user currently has an active
          Socket.IO connection.
        */
        const isConnected = [...sockets.values()].some(
          (socket) => socket.user?.userId === user._id.toString(),
        );

        /*
          Calculate the status other users should see.

          Invisible always appears offline.
          Away/online only appear when actually connected.
        */
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

/*
  Upload / replace current user's profile picture
*/
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

      /*
        Delete previous Cloudinary image if one exists.
      */
      if (user.profilePicturePublicId) {
        try {
          await cloudinary.uploader.destroy(user.profilePicturePublicId);
        } catch (error) {
          console.error("Failed to delete previous profile picture:", error);
        }
      }

      /*
        Upload new image to Cloudinary.
      */
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

/*
  Search users

  IMPORTANT:
  This must come before /:userId.
*/
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

/*
  Get another user's public profile
*/
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId).select(
      "friends isDeleted",
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

    const isFriend = currentUser.friends.some(
      (friendId) => friendId.toString() === user._id.toString(),
    );

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        profilePicture: user.profilePicture || "",
        status: user.status,
        isFriend,
      },
    });
  } catch (error) {
    console.error("Get public profile error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  Delete current account
*/
router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /*
      Delete profile picture from Cloudinary
      when the account is deleted.
    */
    if (user.profilePicturePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicturePublicId);
      } catch (error) {
        console.error(
          "Failed to delete profile picture from Cloudinary:",
          error,
        );
      }
    }

    user.isDeleted = true;
    user.username = "Deleted User";
    user.email = `deleted_${user._id}@chime.local`;
    user.password = "DELETED_ACCOUNT";
    user.profilePicture = "";
    user.profilePicturePublicId = "";

    await user.save();

    res.json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

export default router;
