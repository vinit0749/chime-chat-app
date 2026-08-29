import express from "express";

import {
  createCluster,
  getPublicClusters,
  getMyClusters,
  getClusterMembers,
  joinPublicCluster,
  leaveCluster,
  requestToJoinCluster,
  getClusterJoinRequests,
  approveClusterJoinRequest,
  rejectClusterJoinRequest,
  getMyClusterRequests,
} from "../controllers/clusterController.js";

import { getClusterMessages } from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/*
  ============================================================
  CREATE CLUSTER
  ============================================================
*/

router.post("/", authMiddleware, createCluster);

/*
  ============================================================
  DISCOVER PUBLIC CLUSTERS
  ============================================================
*/

router.get("/public", authMiddleware, getPublicClusters);

/*
  ============================================================
  GET MY CLUSTERS
  ============================================================
*/

router.get("/mine", authMiddleware, getMyClusters);

/*
  ============================================================
  GET MY PENDING JOIN REQUESTS
  ============================================================
*/

router.get("/requests/mine", authMiddleware, getMyClusterRequests);

/*
  ============================================================
  GET CLUSTER MESSAGES
  ============================================================
*/

router.get("/:clusterId/messages", authMiddleware, getClusterMessages);

/*
  ============================================================
  GET CLUSTER MEMBERS
  ============================================================
*/

router.get("/:clusterId/members", authMiddleware, getClusterMembers);

/*
  ============================================================
  JOIN PUBLIC CLUSTER
  ============================================================
*/

router.post("/:clusterId/join", authMiddleware, joinPublicCluster);

/*
  ============================================================
  REQUEST TO JOIN PRIVATE CLUSTER
  ============================================================
*/

router.post("/:clusterId/request", authMiddleware, requestToJoinCluster);

/*
  ============================================================
  LEAVE CLUSTER
  ============================================================
*/

router.delete("/:clusterId/leave", authMiddleware, leaveCluster);

/*
  ============================================================
  GET PRIVATE CLUSTER JOIN REQUESTS
  ============================================================
*/

router.get("/:clusterId/requests", authMiddleware, getClusterJoinRequests);

/*
  ============================================================
  APPROVE PRIVATE CLUSTER JOIN REQUEST
  ============================================================
*/

router.patch(
  "/:clusterId/requests/:userId/approve",
  authMiddleware,
  approveClusterJoinRequest,
);

/*
  ============================================================
  REJECT PRIVATE CLUSTER JOIN REQUEST
  ============================================================
*/

router.delete(
  "/:clusterId/requests/:userId/reject",
  authMiddleware,
  rejectClusterJoinRequest,
);

export default router;
