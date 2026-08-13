import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";

const router = express.Router();

/*
  Send a friend request
*/
router.post("/request/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        message: "You cannot send a friend request to yourself",
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "Your account could not be found",
      });
    }

    if (!targetUser || targetUser.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (currentUser.friends.includes(targetUserId)) {
      return res.status(400).json({
        message: "You are already friends",
      });
    }

    if (currentUser.friendRequestsSent.includes(targetUserId)) {
      return res.status(400).json({
        message: "Friend request already sent",
      });
    }

    if (currentUser.friendRequestsReceived.includes(targetUserId)) {
      return res.status(400).json({
        message: "This user has already sent you a friend request",
      });
    }

    /*
      Check for an existing Friendship record.
    */
    const existingFriendship = await Friendship.findOne({
      $or: [
        {
          requester: currentUserId,
          recipient: targetUserId,
        },
        {
          requester: targetUserId,
          recipient: currentUserId,
        },
      ],
    });

    if (existingFriendship) {
      return res.status(400).json({
        message: "Friend request already exists",
      });
    }

    /*
      Create friendship record.
    */
    await Friendship.create({
      requester: currentUserId,
      recipient: targetUserId,
      status: "pending",
    });

    currentUser.friendRequestsSent.push(targetUserId);
    targetUser.friendRequestsReceived.push(currentUserId);

    await currentUser.save();
    await targetUser.save();

    res.status(201).json({
      message: "Friend request sent",
    });
  } catch (error) {
    console.error("Send friend request error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  Accept a friend request
*/
router.post("/accept/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const requesterId = req.params.userId;

    const currentUser = await User.findById(currentUserId);
    const requester = await User.findById(requesterId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "Your account could not be found",
      });
    }

    if (!requester || requester.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!currentUser.friendRequestsReceived.includes(requesterId)) {
      return res.status(400).json({
        message: "Friend request not found",
      });
    }

    /*
      Find the pending friendship record.
    */
    const friendship = await Friendship.findOne({
      requester: requesterId,
      recipient: currentUserId,
      status: "pending",
    });

    if (!friendship) {
      return res.status(400).json({
        message: "Friendship record not found",
      });
    }

    /*
      Mark friendship as accepted.
    */
    friendship.status = "accepted";

    /*
      Remove pending request.
    */
    currentUser.friendRequestsReceived.pull(requesterId);
    requester.friendRequestsSent.pull(currentUserId);

    /*
      Add each other as friends.
    */
    if (!currentUser.friends.includes(requesterId)) {
      currentUser.friends.push(requesterId);
    }

    if (!requester.friends.includes(currentUserId)) {
      requester.friends.push(currentUserId);
    }

    await friendship.save();
    await currentUser.save();
    await requester.save();

    res.json({
      message: "Friend request accepted",
    });
  } catch (error) {
    console.error("Accept friend request error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  Reject a friend request
*/
router.post("/reject/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const requesterId = req.params.userId;

    const currentUser = await User.findById(currentUserId);
    const requester = await User.findById(requesterId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "Your account could not be found",
      });
    }

    if (!requester || requester.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!currentUser.friendRequestsReceived.includes(requesterId)) {
      return res.status(400).json({
        message: "Friend request not found",
      });
    }

    /*
      Find the pending friendship record.
    */
    const friendship = await Friendship.findOne({
      requester: requesterId,
      recipient: currentUserId,
      status: "pending",
    });

    if (friendship) {
      friendship.status = "rejected";
      await friendship.save();
    }

    currentUser.friendRequestsReceived.pull(requesterId);
    requester.friendRequestsSent.pull(currentUserId);

    await currentUser.save();
    await requester.save();

    res.json({
      message: "Friend request rejected",
    });
  } catch (error) {
    console.error("Reject friend request error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  Get current user's friends
*/
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate(
      "friends",
      "username email isDeleted",
    );

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const friends = user.friends.filter((friend) => !friend.isDeleted);

    res.json({
      friends,
    });
  } catch (error) {
    console.error("Get friends error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  Unfriend a user
*/
router.delete("/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const friendId = req.params.userId;

    if (currentUserId === friendId) {
      return res.status(400).json({
        message: "You cannot unfriend yourself",
      });
    }

    const currentUser = await User.findById(currentUserId);
    const friend = await User.findById(friendId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "Your account could not be found",
      });
    }

    if (!friend || friend.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /*
      Make sure they are actually friends.
    */
    if (!currentUser.friends.includes(friendId)) {
      return res.status(400).json({
        message: "You are not friends with this user",
      });
    }

    /*
      Remove each other from friends lists.
    */
    currentUser.friends.pull(friendId);
    friend.friends.pull(currentUserId);

    /*
      Remove the accepted friendship record.
    */
    await Friendship.findOneAndDelete({
      status: "accepted",
      $or: [
        {
          requester: currentUserId,
          recipient: friendId,
        },
        {
          requester: friendId,
          recipient: currentUserId,
        },
      ],
    });

    await currentUser.save();
    await friend.save();

    res.json({
      message: "Friend removed successfully",
    });
  } catch (error) {
    console.error("Unfriend error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  Get incoming friend requests
*/
router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate(
      "friendRequestsReceived",
      "username email isDeleted",
    );

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const requests = user.friendRequestsReceived.filter(
      (request) => !request.isDeleted,
    );

    res.json({
      requests,
    });
  } catch (error) {
    console.error("Get friend requests error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

export default router;
