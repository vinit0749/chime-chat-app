import mongoose from "mongoose";

const clusterMemberSchema = new mongoose.Schema(
  {
    cluster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cluster",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /*
      Membership state.

      active:
      User is currently a member.

      pending:
      User requested to join a private Cluster
      and is waiting for owner approval.
    */
    status: {
      type: String,
      enum: ["active", "pending"],
      default: "active",
      required: true,
    },

    /*
      Cluster permissions.
    */
    role: {
      type: String,
      enum: ["owner", "member"],
      default: "member",
      required: true,
    },

    lastReadMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/*
  A user can only have one membership/request
  in a particular Cluster.
*/
clusterMemberSchema.index({ cluster: 1, user: 1 }, { unique: true });

const ClusterMember = mongoose.model("ClusterMember", clusterMemberSchema);

export default ClusterMember;
