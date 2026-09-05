import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
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
  onClusterMenuDeleteCluster,
  onClusterMenuWipeChat,
  onClusterMenuLeave,
}) {
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);

  const getClusterInitial = (cluster) => {
    if (!cluster) {
      return "C";
    }

    return cluster.name?.trim()?.charAt(0)?.toUpperCase() || "C";
  };

  const formatUnreadCount = (count) => {
    const unreadCount = Number(count) || 0;

    if (unreadCount <= 0) {
      return null;
    }

    return unreadCount >= 10 ? "10+" : unreadCount;
  };

  const publicClusters = clusters.filter(
    (cluster) => cluster.visibility === "public",
  );

  const privateClusters = clusters.filter(
    (cluster) => cluster.visibility === "private",
  );

  useEffect(() => {
    if (!clusterMenu.isOpen) {
      setMenuPosition(null);
    }
  }, [clusterMenu.isOpen]);

  useEffect(() => {
    if (!clusterMenu.isOpen || !menuPosition) {
      return;
    }

    const handleScroll = () => {
      onCloseClusterMenu();
    };

    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [clusterMenu.isOpen, menuPosition, onCloseClusterMenu]);

  const renderCluster = (cluster, variant) => {
    const isMenuTarget =
      clusterMenu.isOpen &&
      String(clusterMenu.cluster?._id) === String(cluster._id);

    const isOwner =
      String(cluster.owner?._id || cluster.owner || "") === String(user?._id);

    const unreadCount = formatUnreadCount(cluster.unreadCount);

    return (
      <div
        key={cluster._id}
        className="relative"
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();

          setMenuPosition({
            top: event.clientY,
            left: event.currentTarget.getBoundingClientRect().right,
          });

          onOpenClusterMenu(cluster, event);
        }}
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

          {unreadCount !== null && (
            <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-chime-gold px-2 text-[11px] font-bold text-chime-text">
              {unreadCount}
            </span>
          )}
        </button>

        {isMenuTarget &&
          menuPosition &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[99999]"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              }}
            >
              <ClusterContextMenu
                isOwner={isOwner}
                memberCount={cluster.memberCount || 0}
                isPrivate={cluster.visibility === "private"}
                inviteCode={cluster.inviteCode || ""}
                onMembers={onClusterMenuMembers}
                onSettings={onClusterMenuSettings}
                onTransferOwnership={onClusterMenuTransferOwnership}
                onWipeChat={onClusterMenuWipeChat}
                onDeleteCluster={onClusterMenuDeleteCluster}
                onLeaveCluster={onClusterMenuLeave}
              />
            </div>,
            document.body,
          )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-chime-secondary">
          Clusters
        </h3>

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
        <div className="space-y-4">
          <div>
            <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-chime-secondary">
              Private Clusters
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

          <div>
            <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-chime-secondary">
              Public Clusters
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
        </div>
      )}
    </div>
  );
}

export default SidebarClusters;
