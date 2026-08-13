import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/*
  Search users
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
      .select("username")
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

    user.isDeleted = true;
    user.username = "Deleted User";
    user.email = `deleted_${user._id}@chime.local`;
    user.password = "DELETED_ACCOUNT";

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
