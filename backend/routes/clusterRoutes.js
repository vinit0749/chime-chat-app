import express from "express";

import multer from "multer";

import {
  createCluster,
  getPublicClusters,
  getMyClusters,
  getClusterMembers,
  addClusterMember,
  joinPublicCluster,
  joinPrivateCluster,
  leaveCluster,
  requestToJoinCluster,
  getClusterJoinRequests,
  approveClusterJoinRequest,
  rejectClusterJoinRequest,
  getMyClusterRequests,
  updateCluster,
  uploadClusterProfilePicture,
  transferClusterOwnership,
  kickClusterMember,
  deleteCluster,
} from "../controllers/clusterController.js";

import { getClusterMessages } from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post("/", authMiddleware, createCluster);

router.get("/public", authMiddleware, getPublicClusters);

router.get("/mine", authMiddleware, getMyClusters);

router.get("/requests/mine", authMiddleware, getMyClusterRequests);

router.patch("/:clusterId", authMiddleware, updateCluster);

router.put(
  "/:clusterId/profile-picture",
  authMiddleware,
  upload.single("profilePicture"),
  uploadClusterProfilePicture,
);

router.patch(
  "/:clusterId/ownership/:userId",
  authMiddleware,
  transferClusterOwnership,
);

router.post("/:clusterId/members/:userId", authMiddleware, addClusterMember);

router.delete("/:clusterId/members/:userId", authMiddleware, kickClusterMember);

router.delete("/:clusterId", authMiddleware, deleteCluster);

router.get("/:clusterId/messages", authMiddleware, getClusterMessages);

router.get("/:clusterId/members", authMiddleware, getClusterMembers);

router.post("/:clusterId/join", authMiddleware, joinPublicCluster);

router.post("/join-private", authMiddleware, joinPrivateCluster);

router.post("/:clusterId/request", authMiddleware, requestToJoinCluster);

router.delete("/:clusterId/leave", authMiddleware, leaveCluster);

router.get("/:clusterId/requests", authMiddleware, getClusterJoinRequests);

router.patch(
  "/:clusterId/requests/:userId/approve",
  authMiddleware,
  approveClusterJoinRequest,
);

router.delete(
  "/:clusterId/requests/:userId/reject",
  authMiddleware,
  rejectClusterJoinRequest,
);

export default router;
