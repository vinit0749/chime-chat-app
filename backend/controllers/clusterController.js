import mongoose from "mongoose";
import Cluster from "../models/Cluster.js";
import ClusterMember from "../models/ClusterMember.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../config/cloudinary.js";

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const getClusterRoom = (clusterId) => {
  return `cluster:${String(clusterId)}`;
};

const generateInviteCode = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 10; index += 1) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return code;
};

const generateUniqueInviteCode = async () => {
  let inviteCode;

  do {
    inviteCode = generateInviteCode();
  } while (await Cluster.exists({ inviteCode }));

  return inviteCode;
};

const getActiveMembership = async (clusterId, userId) => {
  return ClusterMember.findOne({
    cluster: clusterId,
    user: userId,
    status: "active",
  });
};

const getMemberCount = async (clusterId) => {
  return ClusterMember.countDocuments({
    cluster: clusterId,
    status: "active",
  });
};

const getActiveMembers = async (clusterId) => {
  return ClusterMember.find({
    cluster: clusterId,
    status: "active",
  })
    .populate("user", "username displayName profilePicture status")
    .sort({ role: -1, createdAt: 1 });
};

const formatCluster = async (cluster, extra = {}) => {
  const memberCount = await getMemberCount(cluster._id);

  return {
    _id: cluster._id,
    name: cluster.name,
    description: cluster.description,
    profilePicture: cluster.profilePicture || "",
    visibility: cluster.visibility,
    inviteCode:
      cluster.visibility === "private" ? cluster.inviteCode || "" : "",
    owner: cluster.owner,
    memberCount,
    createdAt: cluster.createdAt,
    ...extra,
  };
};

const emitToClusterMembers = async (
  clusterId,
  event,
  data,
  emitToUser,
  excludeUserId = null,
) => {
  if (!emitToUser) {
    return;
  }

  const memberships = await ClusterMember.find({
    cluster: clusterId,
    status: "active",
  }).select("user");

  memberships.forEach((membership) => {
    const memberUserId = String(membership.user);

    if (excludeUserId && memberUserId === String(excludeUserId)) {
      return;
    }

    emitToUser(memberUserId, event, data);
  });
};

const emitClusterMemberUpdate = async (clusterId, emitToUser) => {
  if (!emitToUser) {
    return;
  }

  const members = await getActiveMembers(clusterId);

  await emitToClusterMembers(
    clusterId,
    "cluster_member_updated",
    {
      clusterId: String(clusterId),
      members,
      memberCount: members.length,
    },
    emitToUser,
  );
};

export const createCluster = async (req, res) => {
  try {
    const { name, description, visibility } = req.body;
    const userId = req.user.userId;

    const trimmedName = String(name || "").trim();
    const trimmedDescription = String(description || "").trim();

    if (!trimmedName) {
      return res.status(400).json({
        message: "Cluster name is required",
      });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({
        message: "Cluster name cannot exceed 100 characters",
      });
    }

    if (trimmedDescription.length > 500) {
      return res.status(400).json({
        message: "Cluster description cannot exceed 500 characters",
      });
    }

    const clusterVisibility = visibility || "public";

    if (!["public", "private"].includes(clusterVisibility)) {
      return res.status(400).json({
        message: "Visibility must be public or private",
      });
    }

    const inviteCode =
      clusterVisibility === "private"
        ? await generateUniqueInviteCode()
        : undefined;

    let profilePicture = "";
    let profilePicturePublicId = "";

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "chime/cluster-profile-pictures",
            resource_type: "image",
            transformation: [
              {
                width: 800,
                height: 800,
                crop: "fill",
                gravity: "center",
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

      profilePicture = uploadResult.secure_url;
      profilePicturePublicId = uploadResult.public_id;
    }

    let cluster;

    try {
      cluster = await Cluster.create({
        name: trimmedName,
        description: trimmedDescription,
        visibility: clusterVisibility,
        inviteCode,
        owner: userId,
        profilePicture,
        profilePicturePublicId,
      });
    } catch (error) {
      if (profilePicturePublicId) {
        try {
          await cloudinary.uploader.destroy(profilePicturePublicId);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up Cluster profile picture:",
            cleanupError,
          );
        }
      }

      throw error;
    }

    try {
      await ClusterMember.create({
        cluster: cluster._id,
        user: userId,
        status: "active",
        role: "owner",
      });
    } catch (error) {
      await Cluster.findByIdAndDelete(cluster._id);

      if (profilePicturePublicId) {
        try {
          await cloudinary.uploader.destroy(profilePicturePublicId);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up Cluster profile picture:",
            cleanupError,
          );
        }
      }

      throw error;
    }

    await cluster.populate("owner", "username displayName profilePicture");

    const formattedCluster = await formatCluster(cluster, {
      role: "owner",
      membershipStatus: "active",
      isMember: true,
    });

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userId, "cluster_joined", {
        cluster: formattedCluster,
      });
    }

    return res.status(201).json({
      message: "Cluster created successfully",
      cluster: formattedCluster,
    });
  } catch (error) {
    console.error("Create Cluster error:", error);

    return res.status(500).json({
      message: "Failed to create Cluster",
    });
  }
};

export const getPublicClusters = async (req, res) => {
  try {
    const userId = req.user.userId;

    const clusters = await Cluster.find({
      visibility: "public",
      isDeleted: false,
    })
      .populate("owner", "username displayName profilePicture")
      .sort({ createdAt: -1 });

    const formattedClusters = await Promise.all(
      clusters.map(async (cluster) => {
        const membership = await ClusterMember.findOne({
          cluster: cluster._id,
          user: userId,
        });

        return formatCluster(cluster, {
          role: membership?.role || null,
          membershipStatus: membership?.status || null,
          isMember: membership?.status === "active",
        });
      }),
    );

    return res.status(200).json({
      clusters: formattedClusters,
    });
  } catch (error) {
    console.error("Get public Clusters error:", error);

    return res.status(500).json({
      message: "Failed to fetch public Clusters",
    });
  }
};

export const getMyClusters = async (req, res) => {
  try {
    const userId = req.user.userId;

    const memberships = await ClusterMember.find({
      user: userId,
      status: "active",
    })
      .populate({
        path: "cluster",
        match: {
          isDeleted: false,
        },
        populate: {
          path: "owner",
          select: "username displayName profilePicture",
        },
      })
      .sort({ updatedAt: -1 });

    const formattedClusters = await Promise.all(
      memberships
        .filter((membership) => membership.cluster)
        .map(async (membership) => {
          const cluster = membership.cluster;

          if (cluster.visibility === "private" && !cluster.inviteCode) {
            cluster.inviteCode = await generateUniqueInviteCode();
            await cluster.save();
          }

          const unreadQuery = {
            cluster: cluster._id,
            sender: { $ne: userId },
          };

          if (membership.lastReadMessage) {
            const lastReadMessage = await Message.findById(
              membership.lastReadMessage,
            ).select("createdAt");

            if (lastReadMessage) {
              unreadQuery.createdAt = {
                $gt: lastReadMessage.createdAt,
              };
            }
          }

          const unreadCount = await Message.countDocuments(unreadQuery);

          return formatCluster(cluster, {
            role: membership.role,
            membershipStatus: membership.status,
            isMember: true,
            unreadCount,
          });
        }),
    );

    return res.status(200).json({
      clusters: formattedClusters,
    });
  } catch (error) {
    console.error("Get my Clusters error:", error);

    return res.status(500).json({
      message: "Failed to fetch your Clusters",
    });
  }
};

export const getClusterMembers = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    }).populate("owner", "username displayName profilePicture");

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const membership = await getActiveMembership(clusterId, userId);

    if (!membership) {
      return res.status(403).json({
        message: "You are not a member of this Cluster",
      });
    }

    const members = await getActiveMembers(clusterId);

    return res.status(200).json({
      cluster: await formatCluster(cluster),
      members,
    });
  } catch (error) {
    console.error("Get Cluster members error:", error);

    return res.status(500).json({
      message: "Failed to fetch Cluster members",
    });
  }
};

export const addClusterMember = async (req, res) => {
  try {
    const { clusterId, userId } = req.params;
    const currentUserId = req.user.userId;

    if (!isValidObjectId(clusterId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID or User ID",
      });
    }

    if (String(userId) === String(currentUserId)) {
      return res.status(400).json({
        message: "You are already a member of this Cluster",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    }).populate("owner", "username displayName profilePicture");

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const currentMembership = await getActiveMembership(
      clusterId,
      currentUserId,
    );

    if (!currentMembership) {
      return res.status(403).json({
        message: "You are not a member of this Cluster",
      });
    }

    const user = await User.findById(userId).select(
      "username displayName profilePicture",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const existingMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
    });

    if (existingMembership?.status === "active") {
      return res.status(400).json({
        message: "This user is already a member of the Cluster",
      });
    }

    if (existingMembership) {
      existingMembership.status = "active";
      existingMembership.role = "member";
      await existingMembership.save();
    } else {
      await ClusterMember.create({
        cluster: clusterId,
        user: userId,
        status: "active",
        role: "member",
      });
    }

    const formattedCluster = await formatCluster(cluster, {
      role: "member",
      membershipStatus: "active",
      isMember: true,
    });

    const clusterIdString = String(clusterId);
    const userIdString = String(userId);

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userIdString, "cluster_joined", {
        cluster: formattedCluster,
      });
    }

    await emitClusterMemberUpdate(clusterId, emitToUser);

    return res.status(200).json({
      message: "User added to Cluster successfully",
      cluster: formattedCluster,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        profilePicture: user.profilePicture || "",
      },
    });
  } catch (error) {
    console.error("Add Cluster member error:", error);

    return res.status(500).json({
      message: "Failed to add user to Cluster",
    });
  }
};

export const joinPublicCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      visibility: "public",
      isDeleted: false,
    }).populate("owner", "username displayName profilePicture");

    if (!cluster) {
      return res.status(404).json({
        message: "Public Cluster not found",
      });
    }

    const existingMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
    });

    if (existingMembership) {
      if (existingMembership.status === "active") {
        return res.status(400).json({
          message: "You are already a member of this Cluster",
        });
      }

      existingMembership.status = "active";
      existingMembership.role = "member";
      await existingMembership.save();

      const formattedCluster = await formatCluster(cluster, {
        role: "member",
        membershipStatus: "active",
        isMember: true,
      });

      const emitToUser = req.app.get("emitToUser");

      if (emitToUser) {
        emitToUser(userId, "cluster_joined", {
          cluster: formattedCluster,
        });
      }

      await emitClusterMemberUpdate(clusterId, emitToUser);

      return res.status(200).json({
        message: "Joined Cluster successfully",
        cluster: formattedCluster,
      });
    }

    const membership = await ClusterMember.create({
      cluster: clusterId,
      user: userId,
      status: "active",
      role: "member",
    });

    const formattedCluster = await formatCluster(cluster, {
      role: membership.role,
      membershipStatus: membership.status,
      isMember: true,
    });

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userId, "cluster_joined", {
        cluster: formattedCluster,
      });
    }

    await emitClusterMemberUpdate(clusterId, emitToUser);

    return res.status(200).json({
      message: "Joined Cluster successfully",
      cluster: formattedCluster,
    });
  } catch (error) {
    console.error("Join public Cluster error:", error);

    return res.status(500).json({
      message: "Failed to join Cluster",
    });
  }
};

export const joinPrivateCluster = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.userId;

    const normalizedInviteCode = String(inviteCode || "")
      .trim()
      .toUpperCase();

    if (!normalizedInviteCode) {
      return res.status(400).json({
        message: "Invite code is required",
      });
    }

    if (!/^[A-Z0-9]{10}$/.test(normalizedInviteCode)) {
      return res.status(400).json({
        message: "Invite code must be exactly 10 characters",
      });
    }

    const cluster = await Cluster.findOne({
      inviteCode: normalizedInviteCode,
      visibility: "private",
      isDeleted: false,
    }).populate("owner", "username displayName profilePicture");

    if (!cluster) {
      return res.status(404).json({
        message: "Invalid invite code",
      });
    }

    if (String(cluster.owner._id) === String(userId)) {
      return res.status(400).json({
        message: "You are already the owner of this Cluster",
      });
    }

    const existingMembership = await ClusterMember.findOne({
      cluster: cluster._id,
      user: userId,
    });

    if (existingMembership?.status === "active") {
      return res.status(400).json({
        message: "You are already a member of this Cluster",
      });
    }

    if (existingMembership?.status === "pending") {
      return res.status(400).json({
        message: "Your request is already pending",
      });
    }

    const membership = await ClusterMember.create({
      cluster: cluster._id,
      user: userId,
      status: "pending",
      role: "member",
    });

    const requester = await User.findById(userId).select(
      "username displayName profilePicture status",
    );

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(cluster.owner._id), "cluster_join_request", {
        clusterId: String(cluster._id),
        request: {
          _id: membership._id,
          userId: String(userId),
          source: "invite_code",
          user: requester,
        },
      });
    }

    return res.status(201).json({
      message: "Join request sent successfully. Waiting for owner approval.",
      cluster: await formatCluster(cluster),
      membershipStatus: "pending",
    });
  } catch (error) {
    console.error("Join private Cluster by invite code error:", error);

    return res.status(500).json({
      message: "Failed to send join request",
    });
  }
};

export const leaveCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const membership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "active",
    });

    if (!membership) {
      return res.status(404).json({
        message: "You are not a member of this Cluster",
      });
    }

    if (membership.role === "owner") {
      return res.status(400).json({
        message: "Cluster owner cannot leave the Cluster",
      });
    }

    await ClusterMember.deleteOne({
      _id: membership._id,
    });

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userId, "cluster_left", {
        clusterId: String(clusterId),
      });
    }

    if (cluster) {
      await emitClusterMemberUpdate(clusterId, emitToUser);
    }

    return res.status(200).json({
      message: "Left Cluster successfully",
    });
  } catch (error) {
    console.error("Leave Cluster error:", error);

    return res.status(500).json({
      message: "Failed to leave Cluster",
    });
  }
};

export const requestToJoinCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      visibility: "private",
      isDeleted: false,
    }).populate("owner", "username displayName profilePicture");

    if (!cluster) {
      return res.status(404).json({
        message: "Private Cluster not found",
      });
    }

    const existingMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
    });

    if (existingMembership) {
      if (existingMembership.status === "active") {
        return res.status(400).json({
          message: "You are already a member of this Cluster",
        });
      }

      return res.status(400).json({
        message: "Your request is already pending",
      });
    }

    const membership = await ClusterMember.create({
      cluster: clusterId,
      user: userId,
      status: "pending",
      role: "member",
    });

    const requester = await User.findById(userId).select(
      "username displayName profilePicture status",
    );

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(cluster.owner._id), "cluster_join_request", {
        clusterId: String(clusterId),
        request: {
          _id: membership._id,
          userId: String(userId),
          source: "request",
          user: requester,
        },
      });
    }

    return res.status(201).json({
      message: "Join request sent successfully",
    });
  } catch (error) {
    console.error("Request to join Cluster error:", error);

    return res.status(500).json({
      message: "Failed to send join request",
    });
  }
};

export const getClusterJoinRequests = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    if (String(cluster.owner) !== String(userId)) {
      return res.status(403).json({
        message: "Only the Cluster owner can view join requests",
      });
    }

    const requests = await ClusterMember.find({
      cluster: clusterId,
      status: "pending",
    })
      .populate("user", "username displayName profilePicture")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      requests,
    });
  } catch (error) {
    console.error("Get Cluster join requests error:", error);

    return res.status(500).json({
      message: "Failed to fetch Cluster join requests",
    });
  }
};

export const approveClusterJoinRequest = async (req, res) => {
  try {
    const { clusterId, userId } = req.params;
    const currentUserId = req.user.userId;

    if (!isValidObjectId(clusterId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID or User ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    if (String(cluster.owner) !== String(currentUserId)) {
      return res.status(403).json({
        message: "Only the Cluster owner can approve join requests",
      });
    }

    const membership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "pending",
    });

    if (!membership) {
      return res.status(404).json({
        message: "Join request not found",
      });
    }

    membership.status = "active";
    membership.role = "member";

    await membership.save();

    const memberCount = await getMemberCount(clusterId);

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(userId), "cluster_join_request_approved", {
        clusterId: String(clusterId),
      });
    }

    await emitClusterMemberUpdate(clusterId, emitToUser);

    return res.status(200).json({
      message: "Join request approved",
      memberCount,
    });
  } catch (error) {
    console.error("Approve Cluster join request error:", error);

    return res.status(500).json({
      message: "Failed to approve join request",
    });
  }
};

export const rejectClusterJoinRequest = async (req, res) => {
  try {
    const { clusterId, userId } = req.params;
    const currentUserId = req.user.userId;

    if (!isValidObjectId(clusterId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID or User ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    if (String(cluster.owner) !== String(currentUserId)) {
      return res.status(403).json({
        message: "Only the Cluster owner can reject join requests",
      });
    }

    const membership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "pending",
    });

    if (!membership) {
      return res.status(404).json({
        message: "Join request not found",
      });
    }

    await ClusterMember.deleteOne({
      _id: membership._id,
    });

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(String(userId), "cluster_join_request_rejected", {
        clusterId: String(clusterId),
      });
    }

    return res.status(200).json({
      message: "Join request rejected",
    });
  } catch (error) {
    console.error("Reject Cluster join request error:", error);

    return res.status(500).json({
      message: "Failed to reject join request",
    });
  }
};

export const getMyClusterRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    const requests = await ClusterMember.find({
      user: userId,
      status: "pending",
    })
      .populate({
        path: "cluster",
        match: {
          isDeleted: false,
        },
        populate: {
          path: "owner",
          select: "username displayName profilePicture",
        },
      })
      .sort({ createdAt: -1 });

    const formattedRequests = requests
      .filter((request) => request.cluster)
      .map((request) => ({
        _id: request._id,
        cluster: request.cluster,
        createdAt: request.createdAt,
      }));

    return res.status(200).json({
      requests: formattedRequests,
    });
  } catch (error) {
    console.error("Get my Cluster requests error:", error);

    return res.status(500).json({
      message: "Failed to fetch your Cluster requests",
    });
  }
};

export const updateCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { name, description, visibility } = req.body;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const membership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "active",
      role: "owner",
    });

    if (!membership) {
      return res.status(403).json({
        message: "Only the Cluster owner can update Cluster settings",
      });
    }

    if (name !== undefined) {
      const trimmedName = String(name).trim();

      if (!trimmedName) {
        return res.status(400).json({
          message: "Cluster name is required",
        });
      }

      if (trimmedName.length > 100) {
        return res.status(400).json({
          message: "Cluster name cannot exceed 100 characters",
        });
      }

      cluster.name = trimmedName;
    }

    if (description !== undefined) {
      const trimmedDescription = String(description).trim();

      if (trimmedDescription.length > 500) {
        return res.status(400).json({
          message: "Cluster description cannot exceed 500 characters",
        });
      }

      cluster.description = trimmedDescription;
    }

    if (visibility !== undefined) {
      if (!["public", "private"].includes(visibility)) {
        return res.status(400).json({
          message: "Visibility must be public or private",
        });
      }

      if (visibility === "private" && cluster.visibility !== "private") {
        cluster.inviteCode = await generateUniqueInviteCode();
      }

      if (visibility === "public" && cluster.visibility === "private") {
        cluster.inviteCode = undefined;
      }

      cluster.visibility = visibility;
    }

    await cluster.save();

    await cluster.populate("owner", "username displayName profilePicture");

    const formattedCluster = await formatCluster(cluster);

    const eventData = {
      cluster: formattedCluster,
    };

    const io = req.app.get("io");
    const emitToUser = req.app.get("emitToUser");

    if (io) {
      io.to(getClusterRoom(clusterId)).emit("cluster_updated", eventData);
    }

    await emitToClusterMembers(
      clusterId,
      "cluster_updated",
      eventData,
      emitToUser,
    );

    return res.status(200).json({
      message: "Cluster updated successfully",
      cluster: formattedCluster,
    });
  } catch (error) {
    console.error("Update Cluster error:", error);

    return res.status(500).json({
      message: "Failed to update Cluster",
    });
  }
};

export const uploadClusterProfilePicture = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "No Cluster profile picture provided",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const ownerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "active",
      role: "owner",
    });

    if (!ownerMembership) {
      return res.status(403).json({
        message:
          "Only the Cluster owner can update the Cluster profile picture",
      });
    }

    if (cluster.profilePicturePublicId) {
      try {
        await cloudinary.uploader.destroy(cluster.profilePicturePublicId);
      } catch (error) {
        console.error(
          "Failed to delete previous Cluster profile picture:",
          error,
        );
      }
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "chime/cluster-profile-pictures",
          resource_type: "image",
          transformation: [
            {
              width: 800,
              height: 800,
              crop: "fill",
              gravity: "center",
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

    cluster.profilePicture = uploadResult.secure_url;
    cluster.profilePicturePublicId = uploadResult.public_id;

    await cluster.save();

    await cluster.populate("owner", "username displayName profilePicture");

    const formattedCluster = await formatCluster(cluster);

    const eventData = {
      cluster: formattedCluster,
    };

    const io = req.app.get("io");
    const emitToUser = req.app.get("emitToUser");

    if (io) {
      io.to(getClusterRoom(clusterId)).emit("cluster_updated", eventData);
    }

    await emitToClusterMembers(
      clusterId,
      "cluster_updated",
      eventData,
      emitToUser,
    );

    return res.status(200).json({
      message: "Cluster profile picture updated successfully",
      cluster: formattedCluster,
    });
  } catch (error) {
    console.error("Cluster profile picture upload error:", error);

    return res.status(500).json({
      message: "Failed to upload Cluster profile picture",
    });
  }
};

export const transferClusterOwnership = async (req, res) => {
  try {
    const { clusterId, userId } = req.params;
    const currentUserId = req.user.userId;

    if (!isValidObjectId(clusterId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID or User ID",
      });
    }

    if (String(userId) === String(currentUserId)) {
      return res.status(400).json({
        message: "You are already the Cluster owner",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const currentOwnerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: currentUserId,
      status: "active",
      role: "owner",
    });

    if (!currentOwnerMembership) {
      return res.status(403).json({
        message: "Only the Cluster owner can transfer ownership",
      });
    }

    const newOwnerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "active",
    });

    if (!newOwnerMembership) {
      return res.status(404).json({
        message: "The selected user is not an active Cluster member",
      });
    }

    cluster.owner = userId;
    await cluster.save();

    currentOwnerMembership.role = "member";
    await currentOwnerMembership.save();

    newOwnerMembership.role = "owner";
    await newOwnerMembership.save();

    await cluster.populate("owner", "username displayName profilePicture");

    const formattedCluster = await formatCluster(cluster);

    const eventData = {
      cluster: formattedCluster,
      previousOwnerId: String(currentUserId),
      newOwnerId: String(userId),
    };

    const io = req.app.get("io");
    const emitToUser = req.app.get("emitToUser");

    if (io) {
      io.to(getClusterRoom(clusterId)).emit(
        "cluster_ownership_transferred",
        eventData,
      );
    }

    await emitToClusterMembers(
      clusterId,
      "cluster_ownership_transferred",
      eventData,
      emitToUser,
    );

    return res.status(200).json({
      message: "Cluster ownership transferred successfully",
      cluster: formattedCluster,
    });
  } catch (error) {
    console.error("Transfer Cluster ownership error:", error);

    return res.status(500).json({
      message: "Failed to transfer Cluster ownership",
    });
  }
};

export const kickClusterMember = async (req, res) => {
  try {
    const { clusterId, userId } = req.params;
    const currentUserId = req.user.userId;

    if (!isValidObjectId(clusterId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID or User ID",
      });
    }

    if (String(userId) === String(currentUserId)) {
      return res.status(400).json({
        message: "You cannot kick yourself from the Cluster",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const ownerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: currentUserId,
      status: "active",
      role: "owner",
    });

    if (!ownerMembership) {
      return res.status(403).json({
        message: "Only the Cluster owner can kick members",
      });
    }

    const membership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "active",
    });

    if (!membership) {
      return res.status(404).json({
        message: "Cluster member not found",
      });
    }

    if (membership.role === "owner") {
      return res.status(400).json({
        message: "The Cluster owner cannot be kicked",
      });
    }

    await ClusterMember.deleteOne({
      _id: membership._id,
    });

    const clusterIdString = String(clusterId);
    const userIdString = String(userId);

    const kickData = {
      clusterId: clusterIdString,
      userId: userIdString,
    };

    const io = req.app.get("io");
    const emitToUser = req.app.get("emitToUser");

    if (io) {
      io.to(getClusterRoom(clusterId)).emit("cluster_member_kicked", kickData);
    }

    if (emitToUser) {
      emitToUser(userIdString, "cluster_kicked", {
        clusterId: clusterIdString,
      });
    }

    await emitClusterMemberUpdate(clusterId, emitToUser);

    return res.status(200).json({
      message: "Member kicked successfully",
      clusterId: clusterIdString,
      userId: userIdString,
    });
  } catch (error) {
    console.error("Kick Cluster member error:", error);

    return res.status(500).json({
      message: "Failed to kick Cluster member",
    });
  }
};

export const deleteCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const currentUserId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const cluster = await Cluster.findOne({
      _id: clusterId,
      isDeleted: false,
    });

    if (!cluster) {
      return res.status(404).json({
        message: "Cluster not found",
      });
    }

    const ownerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: currentUserId,
      status: "active",
      role: "owner",
    });

    if (!ownerMembership) {
      return res.status(403).json({
        message: "Only the Cluster owner can delete the Cluster",
      });
    }

    const activeMemberships = await ClusterMember.find({
      cluster: clusterId,
      status: "active",
    }).select("user");

    const memberUserIds = activeMemberships.map((membership) =>
      String(membership.user),
    );

    cluster.isDeleted = true;
    await cluster.save();

    await Message.deleteMany({
      cluster: clusterId,
    });

    await ClusterMember.deleteMany({
      cluster: clusterId,
    });

    const clusterIdString = String(clusterId);

    const deleteData = {
      clusterId: clusterIdString,
    };

    const io = req.app.get("io");
    const emitToUser = req.app.get("emitToUser");

    if (io) {
      io.to(getClusterRoom(clusterId)).emit("cluster_deleted", deleteData);
    }

    if (emitToUser) {
      memberUserIds.forEach((memberUserId) => {
        emitToUser(memberUserId, "cluster_deleted", deleteData);
      });
    }

    return res.status(200).json({
      message: "Cluster deleted successfully",
      clusterId: clusterIdString,
    });
  } catch (error) {
    console.error("Delete Cluster error:", error);

    return res.status(500).json({
      message: "Failed to delete Cluster",
    });
  }
};
