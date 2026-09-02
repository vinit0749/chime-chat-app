import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";

const router = express.Router();

/*
  ============================================================
  SOCKET REAL-TIME HELPER
  ============================================================
*/

const emitToUser = (req, userId, event, data) => {
  const emit = req.app.get("emitToUser");

  if (typeof emit !== "function") {
    return;
  }

  emit(String(userId), event, data);
};

/*
  ============================================================
  SEND FRIEND REQUEST
  ============================================================
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

    /*
      Blocked users cannot send or receive friend requests
      between each other.
    */
    if (
      currentUser.blockedUsers.includes(targetUserId) ||
      targetUser.blockedUsers.includes(currentUserId)
    ) {
      return res.status(403).json({
        message: "You cannot send a friend request to this user",
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
      if (existingFriendship.status === "accepted") {
        return res.status(400).json({
          message: "You are already friends",
        });
      }

      if (existingFriendship.status === "pending") {
        return res.status(400).json({
          message: "Friend request already exists",
        });
      }

      /*
    A rejected friendship is no longer active.
    Remove the old record so a fresh request can be created.
  */
      if (existingFriendship.status === "rejected") {
        await Friendship.deleteOne({
          _id: existingFriendship._id,
        });
      }
    }

    await Friendship.create({
      requester: currentUserId,
      recipient: targetUserId,
      status: "pending",
    });

    currentUser.friendRequestsSent.push(targetUserId);
    targetUser.friendRequestsReceived.push(currentUserId);

    await currentUser.save();
    await targetUser.save();

    /*
      Notify recipient immediately.
    */
    emitToUser(req, targetUserId, "friend_request_received", {
      user: {
        _id: currentUser._id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        profilePicture: currentUser.profilePicture,
      },
    });

    /*
      Confirm to sender immediately.
    */
    emitToUser(req, currentUserId, "friend_request_sent", {
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        displayName: targetUser.displayName,
        profilePicture: targetUser.profilePicture,
      },
    });

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
  ============================================================
  ACCEPT FRIEND REQUEST
  ============================================================
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

    /*
      A blocked relationship cannot become a friendship.
    */
    if (
      currentUser.blockedUsers.includes(requesterId) ||
      requester.blockedUsers.includes(currentUserId)
    ) {
      return res.status(403).json({
        message: "You cannot accept this friend request",
      });
    }

    if (!currentUser.friendRequestsReceived.includes(requesterId)) {
      return res.status(400).json({
        message: "Friend request not found",
      });
    }

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

    friendship.status = "accepted";

    currentUser.friendRequestsReceived.pull(requesterId);
    requester.friendRequestsSent.pull(currentUserId);

    if (!currentUser.friends.includes(requesterId)) {
      currentUser.friends.push(requesterId);
    }

    if (!requester.friends.includes(currentUserId)) {
      requester.friends.push(currentUserId);
    }

    await friendship.save();
    await currentUser.save();
    await requester.save();

    /*
      Notify both users immediately.
    */
    const currentUserData = {
      _id: currentUser._id,
      username: currentUser.username,
      displayName: currentUser.displayName,
      profilePicture: currentUser.profilePicture,
    };

    const requesterData = {
      _id: requester._id,
      username: requester.username,
      displayName: requester.displayName,
      profilePicture: requester.profilePicture,
    };

    emitToUser(req, currentUserId, "friend_request_accepted", {
      user: requesterData,
    });

    emitToUser(req, requesterId, "friend_request_accepted", {
      user: currentUserData,
    });

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
  ============================================================
  REJECT FRIEND REQUEST
  ============================================================
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

    /*
      Notify both users immediately.
    */
    emitToUser(req, currentUserId, "friend_request_rejected", {
      userId: requesterId,
    });

    emitToUser(req, requesterId, "friend_request_rejected", {
      userId: currentUserId,
    });

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
  ============================================================
  GET CURRENT USER'S FRIENDS
  ============================================================
*/

router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate(
      "friends",
      "username displayName email isDeleted profilePicture",
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
  ============================================================
  UNFRIEND
  ============================================================
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

    if (!currentUser.friends.includes(friendId)) {
      return res.status(400).json({
        message: "You are not friends with this user",
      });
    }

    /*
      Remove friendship in both directions.
    */
    currentUser.friends.pull(friendId);
    friend.friends.pull(currentUserId);

    /*
      Remove accepted Friendship record.
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

    /*
      Tell both clients immediately.
    */
    emitToUser(req, currentUserId, "friend_removed", {
      userId: friendId,
    });

    emitToUser(req, friendId, "friend_removed", {
      userId: currentUserId,
    });

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
  ============================================================
  BLOCK USER
  ============================================================

  Blocking:
  - Adds target to current user's blockedUsers.
  - Instantly removes friendship in both directions.
  - Removes pending friend requests in both directions.
  - Removes all Friendship records between both users.
  - Immediately notifies both clients.
  ============================================================
*/

router.post("/block/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        message: "You cannot block yourself",
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

    if (currentUser.blockedUsers.includes(targetUserId)) {
      return res.status(400).json({
        message: "User is already blocked",
      });
    }

    /*
      Add target to blocked users.
    */
    currentUser.blockedUsers.push(targetUserId);

    /*
      Remove friendship in both directions.
    */
    currentUser.friends.pull(targetUserId);
    targetUser.friends.pull(currentUserId);

    /*
      Remove pending friend requests in both directions.
    */
    currentUser.friendRequestsSent.pull(targetUserId);
    currentUser.friendRequestsReceived.pull(targetUserId);

    targetUser.friendRequestsSent.pull(currentUserId);
    targetUser.friendRequestsReceived.pull(currentUserId);

    /*
      Remove every Friendship record between the users.
    */
    await Friendship.deleteMany({
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

    await currentUser.save();
    await targetUser.save();

    /*
      Notify the blocker.
      This allows their UI to immediately change the DM state.
    */
    emitToUser(req, currentUserId, "user_blocked", {
      userId: targetUserId,
    });

    /*
      Notify the blocked user.
      Their friend list / DM state can immediately update too.
    */
    emitToUser(req, targetUserId, "user_blocked_by_other", {
      userId: currentUserId,
    });

    res.json({
      message: "User blocked successfully",
    });
  } catch (error) {
    console.error("Block user error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  ============================================================
  UNBLOCK USER
  ============================================================
*/

router.delete("/block/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        message: "You cannot unblock yourself",
      });
    }

    const currentUser = await User.findById(currentUserId);

    if (!currentUser || currentUser.isDeleted) {
      return res.status(404).json({
        message: "Your account could not be found",
      });
    }

    if (!currentUser.blockedUsers.includes(targetUserId)) {
      return res.status(400).json({
        message: "User is not blocked",
      });
    }

    currentUser.blockedUsers.pull(targetUserId);

    await currentUser.save();

    /*
      Notify the current user's other connected clients.
      The other user does not need to know that they were unblocked;
      there is no friendship restoration.
    */
    emitToUser(req, currentUserId, "user_unblocked", {
      userId: targetUserId,
    });

    res.json({
      message: "User unblocked successfully",
    });
  } catch (error) {
    console.error("Unblock user error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  ============================================================
  GET BLOCKED USERS
  ============================================================
*/

router.get("/blocked", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate(
      "blockedUsers",
      "username displayName email isDeleted profilePicture",
    );

    if (!user || user.isDeleted) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const blockedUsers = user.blockedUsers.filter(
      (blockedUser) => !blockedUser.isDeleted,
    );

    res.json({
      blockedUsers,
    });
  } catch (error) {
    console.error("Get blocked users error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/*
  ============================================================
  GET INCOMING FRIEND REQUESTS
  ============================================================
*/

router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate(
      "friendRequestsReceived",
      "username displayName email isDeleted profilePicture",
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
