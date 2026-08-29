import mongoose from "mongoose";
import Cluster from "../models/Cluster.js";
import ClusterMember from "../models/ClusterMember.js";

/*
  ============================================================
  HELPERS
  ============================================================
*/

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
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

const formatCluster = async (cluster, extra = {}) => {
  const memberCount = await getMemberCount(cluster._id);

  return {
    _id: cluster._id,
    name: cluster.name,
    description: cluster.description,
    visibility: cluster.visibility,
    owner: cluster.owner,
    memberCount,
    createdAt: cluster.createdAt,
    ...extra,
  };
};

/*
  ============================================================
  CREATE CLUSTER
  ============================================================
*/

export const createCluster = async (req, res) => {
  try {
    const { name, description = "", visibility } = req.body;
    const userId = req.user.userId;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Cluster name is required",
      });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : "";

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

    if (!["public", "private"].includes(visibility)) {
      return res.status(400).json({
        message: "Cluster visibility must be public or private",
      });
    }

    const cluster = await Cluster.create({
      name: trimmedName,
      description: trimmedDescription,
      visibility,
      owner: userId,
    });

    const membership = await ClusterMember.create({
      cluster: cluster._id,
      user: userId,
      role: "owner",
      status: "active",
    });

    await cluster.populate({
      path: "owner",
      select: "username displayName profilePicture",
    });

    const formattedCluster = await formatCluster(cluster, {
      role: membership.role,
    });

    return res.status(201).json({
      message: "Cluster created successfully",
      cluster: formattedCluster,
    });
  } catch (error) {
    console.error("Create cluster error:", error);

    return res.status(500).json({
      message: "Failed to create Cluster",
    });
  }
};

/*
  ============================================================
  GET PUBLIC CLUSTERS
  ============================================================
*/

export const getPublicClusters = async (req, res) => {
  try {
    const userId = req.user.userId;

    const clusters = await Cluster.find({
      visibility: "public",
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .populate("owner", "username displayName profilePicture");

    const formattedClusters = await Promise.all(
      clusters.map(async (cluster) => {
        const membership = await ClusterMember.findOne({
          cluster: cluster._id,
          user: userId,
        }).select("status role");

        return formatCluster(cluster, {
          role: membership?.status === "active" ? membership.role : null,
          membershipStatus: membership?.status || null,
          isMember: membership?.status === "active",
        });
      }),
    );

    return res.status(200).json({
      clusters: formattedClusters,
    });
  } catch (error) {
    console.error("Get public clusters error:", error);

    return res.status(500).json({
      message: "Failed to fetch public Clusters",
    });
  }
};

/*
  ============================================================
  GET MY CLUSTERS
  ============================================================
*/

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

    const clusters = await Promise.all(
      memberships
        .filter((membership) => membership.cluster)
        .map(async (membership) => {
          return formatCluster(membership.cluster, {
            role: membership.role,
            membershipStatus: membership.status,
            isMember: true,
          });
        }),
    );

    return res.status(200).json({
      clusters,
    });
  } catch (error) {
    console.error("Get my clusters error:", error);

    return res.status(500).json({
      message: "Failed to fetch your Clusters",
    });
  }
};

/*
  ============================================================
  GET CLUSTER MEMBERS
  ============================================================
*/

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

    const members = await ClusterMember.find({
      cluster: clusterId,
      status: "active",
    })
      .populate("user", "username displayName profilePicture status isDeleted")
      .sort({ role: 1, createdAt: 1 });

    const formattedMembers = members
      .filter((member) => member.user && !member.user.isDeleted)
      .map((member) => ({
        _id: member._id,
        user: member.user,
        role: member.role,
        status: member.status,
        createdAt: member.createdAt,
      }));

    return res.status(200).json({
      cluster: {
        _id: cluster._id,
        name: cluster.name,
        description: cluster.description,
        visibility: cluster.visibility,
        owner: cluster.owner,
        memberCount: formattedMembers.length,
        role: membership.role,
      },
      members: formattedMembers,
    });
  } catch (error) {
    console.error("Get Cluster members error:", error);

    return res.status(500).json({
      message: "Failed to fetch Cluster members",
    });
  }
};

/*
  ============================================================
  JOIN PUBLIC CLUSTER
  ============================================================
*/

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
          membership: existingMembership,
        });
      }

      return res.status(200).json({
        message: "Joined Cluster successfully",
        cluster: formattedCluster,
        membership: existingMembership,
      });
    }

    const membership = await ClusterMember.create({
      cluster: clusterId,
      user: userId,
      role: "member",
      status: "active",
    });

    const formattedCluster = await formatCluster(cluster, {
      role: "member",
      membershipStatus: "active",
      isMember: true,
    });

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userId, "cluster_joined", {
        cluster: formattedCluster,
        membership,
      });

      emitToUser(cluster.owner._id, "cluster_member_updated", {
        clusterId: String(clusterId),
        userId: String(userId),
        action: "joined",
      });
    }

    return res.status(201).json({
      message: "Joined Cluster successfully",
      cluster: formattedCluster,
      membership,
    });
  } catch (error) {
    console.error("Join public cluster error:", error);

    return res.status(500).json({
      message: "Failed to join Cluster",
    });
  }
};

/*
  ============================================================
  LEAVE CLUSTER
  ============================================================
*/

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
        message:
          "Cluster owner cannot leave the Cluster. Transfer ownership or delete the Cluster instead.",
      });
    }

    await ClusterMember.findByIdAndDelete(membership._id);

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userId, "cluster_left", {
        clusterId: String(clusterId),
      });

      const cluster = await Cluster.findById(clusterId).select("owner");

      if (cluster) {
        emitToUser(cluster.owner, "cluster_member_updated", {
          clusterId: String(clusterId),
          userId: String(userId),
          action: "left",
        });
      }
    }

    return res.status(200).json({
      message: "Left Cluster successfully",
      clusterId: String(clusterId),
    });
  } catch (error) {
    console.error("Leave cluster error:", error);

    return res.status(500).json({
      message: "Failed to leave Cluster",
    });
  }
};

/*
  ============================================================
  REQUEST TO JOIN PRIVATE CLUSTER
  ============================================================
*/

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

      if (existingMembership.status === "pending") {
        return res.status(400).json({
          message: "Your request is already pending",
        });
      }
    }

    const membership = await ClusterMember.create({
      cluster: clusterId,
      user: userId,
      role: "member",
      status: "pending",
    });

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(cluster.owner._id, "cluster_join_request", {
        clusterId: String(clusterId),
        userId: String(userId),
        membership,
      });
    }

    return res.status(201).json({
      message: "Cluster join request sent",
      membership,
    });
  } catch (error) {
    console.error("Request to join Cluster error:", error);

    return res.status(500).json({
      message: "Failed to request Cluster membership",
    });
  }
};

/*
  ============================================================
  GET CLUSTER JOIN REQUESTS
  ============================================================
*/

export const getClusterJoinRequests = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const userId = req.user.userId;

    if (!isValidObjectId(clusterId)) {
      return res.status(400).json({
        message: "Invalid Cluster ID",
      });
    }

    const ownerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      role: "owner",
      status: "active",
    });

    if (!ownerMembership) {
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

/*
  ============================================================
  APPROVE CLUSTER JOIN REQUEST
  ============================================================
*/

export const approveClusterJoinRequest = async (req, res) => {
  try {
    const { clusterId, userId } = req.params;
    const ownerId = req.user.userId;

    if (!isValidObjectId(clusterId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid Cluster or User ID",
      });
    }

    const ownerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: ownerId,
      role: "owner",
      status: "active",
    });

    if (!ownerMembership) {
      return res.status(403).json({
        message: "Only the Cluster owner can approve requests",
      });
    }

    const request = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        message: "Join request not found",
      });
    }

    request.status = "active";

    await request.save();

    const cluster = await Cluster.findById(clusterId)
      .select("name description visibility owner")
      .populate("owner", "username displayName profilePicture");

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userId, "cluster_join_request_approved", {
        cluster,
        membership: request,
      });

      emitToUser(ownerId, "cluster_member_updated", {
        clusterId: String(clusterId),
        userId: String(userId),
        action: "joined",
      });
    }

    return res.status(200).json({
      message: "Join request approved",
      membership: request,
    });
  } catch (error) {
    console.error("Approve Cluster join request error:", error);

    return res.status(500).json({
      message: "Failed to approve Cluster join request",
    });
  }
};

/*
  ============================================================
  REJECT CLUSTER JOIN REQUEST
  ============================================================
*/

export const rejectClusterJoinRequest = async (req, res) => {
  try {
    const { clusterId, userId } = req.params;
    const ownerId = req.user.userId;

    if (!isValidObjectId(clusterId) || !isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid Cluster or User ID",
      });
    }

    const ownerMembership = await ClusterMember.findOne({
      cluster: clusterId,
      user: ownerId,
      role: "owner",
      status: "active",
    });

    if (!ownerMembership) {
      return res.status(403).json({
        message: "Only the Cluster owner can reject requests",
      });
    }

    const request = await ClusterMember.findOne({
      cluster: clusterId,
      user: userId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        message: "Join request not found",
      });
    }

    await ClusterMember.findByIdAndDelete(request._id);

    const emitToUser = req.app.get("emitToUser");

    if (emitToUser) {
      emitToUser(userId, "cluster_join_request_rejected", {
        clusterId: String(clusterId),
      });
    }

    return res.status(200).json({
      message: "Join request rejected",
      clusterId: String(clusterId),
    });
  } catch (error) {
    console.error("Reject Cluster join request error:", error);

    return res.status(500).json({
      message: "Failed to reject Cluster join request",
    });
  }
};

/*
  ============================================================
  GET MY PENDING CLUSTER REQUESTS
  ============================================================
*/

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

    return res.status(200).json({
      requests: requests.filter((request) => request.cluster),
    });
  } catch (error) {
    console.error("Get my Cluster requests error:", error);

    return res.status(500).json({
      message: "Failed to fetch your Cluster requests",
    });
  }
};
