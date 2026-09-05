import { useEffect, useRef, useState } from "react";
import { X, Check, Clock, UserPlus } from "lucide-react";
import useSidebarSocket from "../../hooks/useSidebarSocket";
import useSidebarData from "../../hooks/useSidebarData";
import useSidebarSearch from "../../hooks/useSidebarSearch";
import useSidebarActions from "../../hooks/useSidebarActions";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import CreateClusterModal from "../../../clusters/components/CreateClusterModal";
import SidebarClusters from "./SidebarClusters";
import SidebarDirectMessages from "./SidebarDirectMessages";
import SidebarSearch from "./SidebarSearch";
import SidebarFooter from "./SidebarFooter";

function Sidebar({
  mobile = false,
  onClose,
  onSelectChat,
  onSelectCluster,
  onOpenDiscover,
  onOpenFriendRequests,
  onOpenProfile,
  onOpenUserProfile,
  onClusterUpdated,
  onClusterDeleted,
  onClusterMenuAction,
  activeView,
}) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [presence, setPresence] = useState({});

  const [blockedUserIds, setBlockedUserIds] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user")) || {};

      return new Set(
        (storedUser.blockedUsers || [])
          .map((blockedUser) => blockedUser?._id || blockedUser)
          .filter(Boolean)
          .map(String),
      );
    } catch {
      return new Set();
    }
  });

  const [blockedByUserIds, setBlockedByUserIds] = useState(new Set());

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(true);

  const [dmMenu, setDmMenu] = useState({
    isOpen: false,
    user: null,
  });

  const [clusterMenu, setClusterMenu] = useState({
    isOpen: false,
    cluster: null,
  });

  const dmLongPressTimer = useRef(null);
  const clusterLongPressTimer = useRef(null);

  const [isCreateClusterModalOpen, setIsCreateClusterModalOpen] =
    useState(false);

  const isFriend = (userId) => {
    return friends.some((friend) => String(friend._id) === String(userId));
  };

  const findConversation = (userId) => {
    return conversations.find(
      (conversation) => String(conversation._id) === String(userId),
    );
  };

  const {
    search,
    setSearch,
    searchResults,
    isSearching,
    searchRef,
    clearSearch,
    handleOpenSearchProfile,
    handleMessageSearchUser,
  } = useSidebarSearch({
    onOpenUserProfile,
    onSelectChat,
    mobile,
    onClose,
    findConversation,
    isFriend,
  });

  const { fetchCurrentUser, fetchFriends, fetchRequests, fetchClusters } =
    useSidebarData({
      setUser,
      setFriends,
      setConversations,
      setRequests,
      setClusters,
      setBlockedUserIds,
      setLoadingConversations,
      setLoadingClusters,
    });

  const {
    modal,
    isModalLoading,
    openSendRequestModal,
    handleLogout,
    closeModal,
    handleConfirmModal,
    handleCreateCluster,
  } = useSidebarActions({
    setUser,
    setFriends,
    setPresence,
    setBlockedUserIds,
    setClusters,
    fetchRequests,
    fetchClusters,
    clearSearch,
    onSelectCluster,
    setIsCreateClusterModalOpen,
  });

  const handleClusterJoined = (joinedCluster) => {
    if (!joinedCluster?._id) {
      return;
    }

    setClusters((currentClusters) => {
      const existingIndex = currentClusters.findIndex(
        (cluster) => String(cluster._id) === String(joinedCluster._id),
      );

      if (existingIndex === -1) {
        return [...currentClusters, joinedCluster];
      }

      return currentClusters.map((cluster, index) =>
        index === existingIndex
          ? {
              ...cluster,
              ...joinedCluster,
            }
          : cluster,
      );
    });
  };

  const handleClusterMemberJoined = ({
    clusterId,
    member,
    cluster: updatedCluster,
  }) => {
    if (!clusterId) {
      return;
    }

    if (updatedCluster?._id) {
      setClusters((currentClusters) =>
        currentClusters.map((currentCluster) =>
          String(currentCluster._id) === String(updatedCluster._id)
            ? {
                ...currentCluster,
                ...updatedCluster,
              }
            : currentCluster,
        ),
      );

      return;
    }

    if (!member) {
      return;
    }

    setClusters((currentClusters) =>
      currentClusters.map((currentCluster) => {
        if (String(currentCluster._id) !== String(clusterId)) {
          return currentCluster;
        }

        const currentMemberCount = Number(
          currentCluster.memberCount ??
            currentCluster.membersCount ??
            currentCluster.members?.length ??
            0,
        );

        return {
          ...currentCluster,
          memberCount: currentMemberCount + 1,
        };
      }),
    );
  };

  useSidebarSocket({
    user,
    blockedUserIds,
    blockedByUserIds,
    fetchCurrentUser,
    fetchFriends,
    fetchRequests,
    fetchClusters,
    setUser,
    setFriends,
    setRequests,
    setPresence,
    setBlockedUserIds,
    setBlockedByUserIds,
    setDmMenu,
    setClusterMenu,
    setClusters,
    onClusterUpdated,
    onClusterJoined: handleClusterJoined,
    onClusterMemberJoined: handleClusterMemberJoined,
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        clearSearch();
      }

      if (!event.target.closest?.('[data-dm-context-menu="true"]')) {
        setDmMenu({
          isOpen: false,
          user: null,
        });
      }

      if (!event.target.closest?.('[data-cluster-context-menu="true"]')) {
        setClusterMenu({
          isOpen: false,
          cluster: null,
        });
      }
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;

      clearSearch();

      setDmMenu({
        isOpen: false,
        user: null,
      });

      setClusterMenu({
        isOpen: false,
        cluster: null,
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [clearSearch, searchRef]);

  const isPresenceHidden = (userId) => {
    if (!userId) return false;

    const normalizedUserId = String(userId);

    return (
      blockedUserIds.has(normalizedUserId) ||
      blockedByUserIds.has(normalizedUserId)
    );
  };

  const getUserStatus = (userId) => {
    if (!userId) {
      return "offline";
    }

    const normalizedUserId = String(userId);

    if (isPresenceHidden(normalizedUserId)) {
      return "offline";
    }

    return presence[normalizedUserId] || "offline";
  };

  const openDmMenu = (conversation, event) => {
    event.preventDefault();
    event.stopPropagation();

    setClusterMenu({
      isOpen: false,
      cluster: null,
    });

    setDmMenu({
      isOpen: true,
      user: conversation,
    });
  };

  const startDmLongPress = (conversation) => {
    clearTimeout(dmLongPressTimer.current);

    dmLongPressTimer.current = setTimeout(() => {
      setClusterMenu({
        isOpen: false,
        cluster: null,
      });

      setDmMenu({
        isOpen: true,
        user: conversation,
      });
    }, 550);
  };

  const cancelDmLongPress = () => {
    clearTimeout(dmLongPressTimer.current);
  };

  const closeDmMenu = () => {
    setDmMenu({
      isOpen: false,
      user: null,
    });
  };

  const handleDmViewProfile = () => {
    const conversation = dmMenu.user;

    if (!conversation?._id || !onOpenUserProfile) {
      closeDmMenu();
      return;
    }

    closeDmMenu();

    onOpenUserProfile(conversation._id);

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleDmUnfriend = () => {
    const conversation = dmMenu.user;

    if (!conversation?._id) {
      return;
    }

    openSendRequestModal({
      ...conversation,
      actionType: "dmUnfriend",
    });

    closeDmMenu();
  };

  const handleDmBlock = () => {
    const conversation = dmMenu.user;

    if (!conversation?._id) {
      return;
    }

    openSendRequestModal({
      ...conversation,
      actionType: "dmBlock",
    });

    closeDmMenu();
  };

  const handleDmUnblock = async () => {
    const conversation = dmMenu.user;

    if (!conversation?._id) {
      return;
    }

    const unblockedId = String(conversation._id);

    closeDmMenu();

    try {
      const response = await fetch(
        `http://localhost:5000/api/friends/block/${unblockedId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unblock user.");
        return;
      }

      setBlockedUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(unblockedId);
        return nextIds;
      });

      setPresence((currentPresence) => {
        const nextPresence = { ...currentPresence };
        delete nextPresence[unblockedId];
        return nextPresence;
      });

      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const nextBlockedUsers = (currentUser.blockedUsers || [])
          .map((blockedUser) => blockedUser?._id || blockedUser)
          .map(String)
          .filter((id) => id !== unblockedId);

        const nextUser = {
          ...currentUser,
          blockedUsers: nextBlockedUsers,
        };

        localStorage.setItem("user", JSON.stringify(nextUser));

        return nextUser;
      });
    } catch (error) {
      console.error("Failed to unblock user:", error);
    }
  };

  const closeClusterMenu = () => {
    setClusterMenu({
      isOpen: false,
      cluster: null,
    });
  };

  const openClusterMenu = (cluster, event) => {
    event.preventDefault();
    event.stopPropagation();

    setDmMenu({
      isOpen: false,
      user: null,
    });

    setClusterMenu({
      isOpen: true,
      cluster,
    });
  };

  const startClusterLongPress = (cluster) => {
    clearTimeout(clusterLongPressTimer.current);

    clusterLongPressTimer.current = setTimeout(() => {
      setDmMenu({
        isOpen: false,
        user: null,
      });

      setClusterMenu({
        isOpen: true,
        cluster,
      });
    }, 550);
  };

  const cancelClusterLongPress = () => {
    clearTimeout(clusterLongPressTimer.current);
  };

  const handleClusterMenuMembers = () => {
    const cluster = clusterMenu.cluster;

    if (!cluster?._id) {
      closeClusterMenu();
      return;
    }

    closeClusterMenu();
    onClusterMenuAction?.("members", cluster);
  };

  const handleClusterMenuSettings = () => {
    const cluster = clusterMenu.cluster;

    if (!cluster?._id) {
      closeClusterMenu();
      return;
    }

    closeClusterMenu();
    onClusterMenuAction?.("settings", cluster);
  };

  const handleClusterMenuTransferOwnership = () => {
    const cluster = clusterMenu.cluster;

    if (!cluster?._id) {
      closeClusterMenu();
      return;
    }

    closeClusterMenu();
    onClusterMenuAction?.("transfer", cluster);
  };

  const handleClusterMenuLeave = () => {
    const cluster = clusterMenu.cluster;

    if (!cluster?._id) {
      closeClusterMenu();
      return;
    }

    closeClusterMenu();
    onClusterMenuAction?.("leave", cluster);
  };

  const handleSelectConversation = (conversation) => {
    closeDmMenu();

    onSelectChat({
      type: "dm",
      user: conversation,
      isFriend: isFriend(conversation._id),
    });

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleDiscoverClusters = () => {
    if (!onOpenDiscover) return;

    onOpenDiscover();

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleSelectCluster = (cluster) => {
    closeClusterMenu();

    if (!cluster?._id || !onSelectCluster) {
      return;
    }

    onSelectCluster(cluster);

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleOpenFriends = () => {
    onOpenFriendRequests();

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleOpenProfile = () => {
    onOpenProfile();

    if (mobile && onClose) {
      onClose();
    }
  };

  const renderRelationshipButton = (person) => {
    if (person.relationshipStatus === "friends") {
      return (
        <button
          type="button"
          disabled
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title="Already friends"
        >
          <Check size={16} />
        </button>
      );
    }

    if (
      person.relationshipStatus === "sent" ||
      person.relationshipStatus === "received"
    ) {
      return (
        <button
          type="button"
          disabled
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title={
            person.relationshipStatus === "sent"
              ? "Friend request sent"
              : "Friend request received"
          }
        >
          <Clock size={16} />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openSendRequestModal(person);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-chime-text transition hover:bg-chime-gold"
        title="Add friend"
      >
        <UserPlus size={16} />
      </button>
    );
  };

  const renderPresenceIndicator = (userId) => {
    if (isPresenceHidden(userId)) {
      return null;
    }

    const status = getUserStatus(userId);

    if (status === "online") {
      return (
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-chime-background bg-green-500"
          title="Online"
        />
      );
    }

    if (status === "away") {
      return (
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-chime-background bg-yellow-400"
          title="Away"
        />
      );
    }

    return null;
  };

  return (
    <>
      <aside
        className={`h-screen w-72 shrink-0 flex-col border-r border-stone-200 bg-chime-background ${
          mobile ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-5">
          <h1 className="text-2xl font-bold text-chime-text">Chime 🔔</h1>

          {mobile && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-chime-text transition hover:bg-chime-selected"
              aria-label="Close sidebar"
            >
              <X size={22} />
            </button>
          )}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <SidebarSearch
            search={search}
            searchRef={searchRef}
            searchResults={searchResults}
            isSearching={isSearching}
            onSearchChange={setSearch}
            onOpenProfile={handleOpenSearchProfile}
            onMessageUser={handleMessageSearchUser}
            renderRelationshipButton={renderRelationshipButton}
            renderPresenceIndicator={renderPresenceIndicator}
          />

          <SidebarDirectMessages
            conversations={conversations}
            loadingConversations={loadingConversations}
            dmMenu={dmMenu}
            blockedUserIds={blockedUserIds}
            blockedByUserIds={blockedByUserIds}
            activeView={activeView}
            isFriend={isFriend}
            onOpenDmMenu={openDmMenu}
            onStartDmLongPress={startDmLongPress}
            onCancelDmLongPress={cancelDmLongPress}
            onCloseDmMenu={closeDmMenu}
            onSelectConversation={handleSelectConversation}
            onViewProfile={handleDmViewProfile}
            onUnfriend={handleDmUnfriend}
            onBlock={handleDmBlock}
            onUnblock={handleDmUnblock}
            renderPresenceIndicator={renderPresenceIndicator}
          />

          <SidebarClusters
            clusters={clusters}
            loadingClusters={loadingClusters}
            user={user}
            activeView={activeView}
            clusterMenu={clusterMenu}
            onCreateCluster={() => setIsCreateClusterModalOpen(true)}
            onOpenClusterMenu={openClusterMenu}
            onStartClusterLongPress={startClusterLongPress}
            onCancelClusterLongPress={cancelClusterLongPress}
            onCloseClusterMenu={closeClusterMenu}
            onSelectCluster={handleSelectCluster}
            onClusterMenuMembers={handleClusterMenuMembers}
            onClusterMenuSettings={handleClusterMenuSettings}
            onClusterMenuTransferOwnership={handleClusterMenuTransferOwnership}
            onClusterMenuLeave={handleClusterMenuLeave}
          />

          <SidebarFooter
            activeView={activeView}
            requests={requests}
            user={user}
            onDiscover={handleDiscoverClusters}
            onOpenFriends={handleOpenFriends}
            onOpenProfile={handleOpenProfile}
            onLogout={handleLogout}
            renderPresenceIndicator={renderPresenceIndicator}
          />
        </nav>
      </aside>

      <ConfirmModal
        isOpen={modal.isOpen}
        title={
          modal.type === "sendRequest"
            ? "Send friend request?"
            : modal.type === "dmUnfriend"
              ? "Unfriend user?"
              : modal.type === "dmBlock"
                ? "Block user?"
                : "Log out?"
        }
        message={
          modal.type === "sendRequest"
            ? `Send a friend request to ${modal.user?.username}?`
            : modal.type === "dmUnfriend"
              ? `Are you sure you want to unfriend ${
                  modal.user?.displayName ||
                  `@${modal.user?.username || "this user"}`
                }? You will no longer be able to send messages unless you become friends again.`
              : modal.type === "dmBlock"
                ? `Are you sure you want to block ${
                    modal.user?.displayName ||
                    `@${modal.user?.username || "this user"}`
                  }? They will also be removed from your friends list and you will no longer be able to message each other.`
                : "Are you sure you want to log out?"
        }
        confirmText={
          modal.type === "sendRequest"
            ? "Send Request"
            : modal.type === "dmUnfriend"
              ? "Unfriend"
              : modal.type === "dmBlock"
                ? "Block"
                : "Log Out"
        }
        cancelText="Cancel"
        onConfirm={handleConfirmModal}
        onCancel={closeModal}
        loading={isModalLoading}
      />

      <CreateClusterModal
        isOpen={isCreateClusterModalOpen}
        onClose={() => setIsCreateClusterModalOpen(false)}
        onCreated={handleCreateCluster}
        onOpenDiscover={handleDiscoverClusters}
      />
    </>
  );
}

export default Sidebar;
