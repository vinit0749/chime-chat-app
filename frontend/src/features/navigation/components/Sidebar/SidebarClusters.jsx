import { Plus } from "lucide-react";
import ClusterContextMenu from "../../../clusters/components/ClusterContextMenu";

function SidebarClusters({
  clusters,
  loadingClusters,
  user,
  activeView,
  clusterMenu,
  onCreateCluster,
  onOpenClusterMenu,
  onStartClusterLongPress,
  onCancelClusterLongPress,
  onCloseClusterMenu,
  onSelectCluster,
  onClusterMenuMembers,
  onClusterMenuSettings,
  onClusterMenuTransferOwnership,
  onClusterMenuLeave,
}) {
  const getClusterInitial = (cluster) => {
    if (!cluster) {
      return "C";
    }

    return cluster.name?.trim()?.charAt(0)?.toUpperCase() || "C";
  };

  const publicClusters = clusters.filter(
    (cluster) => cluster.visibility === "public",
  );

  const privateClusters = clusters.filter(
    (cluster) => cluster.visibility === "private",
  );

  const renderCluster = (cluster, variant) => {
    const isMenuTarget =
      clusterMenu.isOpen &&
      String(clusterMenu.cluster?._id) === String(cluster._id);

    const isOwner =
      String(cluster.owner?._id || cluster.owner || "") === String(user?._id);

    return (
      <div
        key={cluster._id}
        className="relative"
        onContextMenu={(event) => onOpenClusterMenu(cluster, event)}
        onTouchStart={() => onStartClusterLongPress(cluster)}
        onTouchEnd={onCancelClusterLongPress}
        onTouchMove={onCancelClusterLongPress}
        onTouchCancel={onCancelClusterLongPress}
      >
        <button
          type="button"
          onClick={() => {
            if (isMenuTarget) {
              onCloseClusterMenu();
              return;
            }

            onSelectCluster(cluster);
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition ${
            activeView === `cluster-${cluster._id}`
              ? "bg-chime-selected"
              : "hover:bg-chime-selected"
          }`}
        >
          <div
            className={`h-9 w-9 shrink-0 overflow-hidden rounded-lg ${
              variant === "public" ? "bg-chime-gold" : "bg-chime-selected"
            }`}
          >
            {cluster.profilePicture ? (
              <img
                src={cluster.profilePicture}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-chime-text">
                {getClusterInitial(cluster)}
              </div>
            )}
          </div>

          <span className="min-w-0 flex-1 truncate">
            {cluster.name || "Unnamed Cluster"}
          </span>
        </button>

        {isMenuTarget && (
          <ClusterContextMenu
            isOwner={isOwner}
            isPrivate={cluster.visibility === "private"}
            inviteCode={cluster.inviteCode || ""}
            onMembers={onClusterMenuMembers}
            onSettings={onClusterMenuSettings}
            onTransferOwnership={onClusterMenuTransferOwnership}
            onLeaveCluster={onClusterMenuLeave}
          />
        )}
      </div>
    );
  };

  return (
    <div className="mt-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-chime-secondary">
          Clusters
        </h2>

        <button
          type="button"
          onClick={onCreateCluster}
          className="flex h-6 w-6 items-center justify-center rounded-md text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
          title="Create or join a Cluster"
          aria-label="Create or join a Cluster"
        >
          <Plus size={16} />
        </button>
      </div>

      {loadingClusters ? (
        <p className="px-2 py-2 text-sm text-chime-secondary">Loading...</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-chime-secondary">
              Public
            </h3>

            {publicClusters.length === 0 ? (
              <p className="px-2 py-1 text-xs text-chime-secondary">
                No public Clusters joined.
              </p>
            ) : (
              <div className="space-y-1">
                {publicClusters.map((cluster) =>
                  renderCluster(cluster, "public"),
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-chime-secondary">
              Private
            </h3>

            {privateClusters.length === 0 ? (
              <p className="px-2 py-1 text-xs text-chime-secondary">
                No private Clusters joined.
              </p>
            ) : (
              <div className="space-y-1">
                {privateClusters.map((cluster) =>
                  renderCluster(cluster, "private"),
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SidebarClusters;
