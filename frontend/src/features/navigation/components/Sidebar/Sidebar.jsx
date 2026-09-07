import { useEffect, useRef, useState } from "react";
import { Check, Clock, Heart, UserPlus } from "lucide-react";
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
import { authFetch } from "../../../../shared/utils/authFetch";

function Sidebar({
  mobile = false,
  onClose,
  sidebarSection,
  onSidebarSectionChange,
  onSelectChat,
  onSelectCluster,
  onOpenDiscover,
  onOpenFriendRequests,
  onOpenProfile,
  onOpenUserProfile,
  onOpenNotifications,
  onClusterUpdated,
  onClusterDeleted,
  onClusterMenuAction,
  onClusterMenuDeleteCluster,
  onClusterMenuWipeChat,
  notificationUnreadCount = 0,
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

  const [isClearChatConfirmOpen, setIsClearChatConfirmOpen] = useState(false);
  const [clearChatUser, setClearChatUser] = useState(null);
  const [isClearChatLoading, setIsClearChatLoading] = useState(false);

  const dmLongPressTimer = useRef(null);
  const clusterLongPressTimer = useRef(null);

  const [isCreateClusterModalOpen, setIsCreateClusterModalOpen] =
    useState(false);

  const isFriend = (userId) => {
    return friends.some((friend) => String(friend?._id) === String(userId));
  };

  const findConversation = (userId) => {
    return conversations.find(
      (conversation) => String(conversation?._id) === String(userId),
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
    openDmUnfriendModal,
    openDmBlockModal,
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
        (cluster) => String(cluster?._id) === String(joinedCluster?._id),
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
          String(currentCluster?._id) === String(updatedCluster?._id)
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
        if (String(currentCluster?._id) !== String(clusterId)) {
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
    setConversations,
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
    activeView,
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
      if (event.key !== "Escape") {
        return;
      }

      clearSearch();

      setDmMenu({
        isOpen: false,
        user: null,
      });

      setClusterMenu({
        isOpen: false,
        cluster: null,
      });

      setIsClearChatConfirmOpen(false);
      setClearChatUser(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [clearSearch, searchRef]);

  const isPresenceHidden = (userId) => {
    if (!userId) {
      return false;
    }

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

    openDmUnfriendModal(conversation);
    closeDmMenu();
  };

  const handleDmBlock = () => {
    const conversation = dmMenu.user;

    if (!conversation?._id) {
      return;
    }

    openDmBlockModal(conversation);
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

  const handleDmClearChat = (conversation) => {
    if (!conversation?._id) {
      return;
    }

    closeDmMenu();
    setClearChatUser(conversation);
    setIsClearChatConfirmOpen(true);
  };

  const handleDmPin = async (conversation) => {
    const userId = conversation?._id;

    if (!userId) {
      return;
    }

    closeDmMenu();

    try {
      const response = await authFetch(
        `http://localhost:5000/api/users/pins/dm/${userId}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to pin conversation");
        return;
      }

      setConversations((currentConversations) =>
        currentConversations.map((currentConversation) =>
          String(currentConversation?._id) === String(userId)
            ? {
                ...currentConversation,
                isPinned: true,
              }
            : currentConversation,
        ),
      );

      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const pinnedDMs = currentUser.pinnedDMs || [];
        const alreadyPinned = pinnedDMs.some(
          (pinnedUser) =>
            String(pinnedUser?._id || pinnedUser) === String(userId),
        );

        if (alreadyPinned) {
          return currentUser;
        }

        const nextUser = {
          ...currentUser,
          pinnedDMs: [...pinnedDMs, userId],
        };

        localStorage.setItem("user", JSON.stringify(nextUser));

        return nextUser;
      });
    } catch (error) {
      console.error("Failed to pin conversation:", error);
    }
  };

  const handleDmUnpin = async (conversation) => {
    const userId = conversation?._id;

    if (!userId) {
      return;
    }

    closeDmMenu();

    try {
      const response = await authFetch(
        `http://localhost:5000/api/users/pins/dm/${userId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unpin conversation");
        return;
      }

      setConversations((currentConversations) =>
        currentConversations.map((currentConversation) =>
          String(currentConversation?._id) === String(userId)
            ? {
                ...currentConversation,
                isPinned: false,
              }
            : currentConversation,
        ),
      );

      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const nextUser = {
          ...currentUser,
          pinnedDMs: (currentUser.pinnedDMs || []).filter(
            (pinnedUser) =>
              String(pinnedUser?._id || pinnedUser) !== String(userId),
          ),
        };

        localStorage.setItem("user", JSON.stringify(nextUser));

        return nextUser;
      });
    } catch (error) {
      console.error("Failed to unpin conversation:", error);
    }
  };

  const handleClusterPin = async (cluster) => {
    const clusterId = cluster?._id;

    if (!clusterId) {
      return;
    }

    closeClusterMenu();

    try {
      const response = await authFetch(
        `http://localhost:5000/api/users/pins/cluster/${clusterId}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to pin Cluster");
        return;
      }

      setClusters((currentClusters) => {
        const updatedClusters = currentClusters.map((currentCluster) =>
          String(currentCluster?._id) === String(clusterId)
            ? {
                ...currentCluster,
                isPinned: true,
              }
            : currentCluster,
        );

        return [
          ...updatedClusters.filter(
            (currentCluster) => currentCluster.isPinned,
          ),
          ...updatedClusters.filter(
            (currentCluster) => !currentCluster.isPinned,
          ),
        ];
      });

      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const pinnedClusters = currentUser.pinnedClusters || [];
        const alreadyPinned = pinnedClusters.some(
          (pinnedCluster) =>
            String(pinnedCluster?._id || pinnedCluster) === String(clusterId),
        );

        if (alreadyPinned) {
          return currentUser;
        }

        const nextUser = {
          ...currentUser,
          pinnedClusters: [...pinnedClusters, clusterId],
        };

        localStorage.setItem("user", JSON.stringify(nextUser));

        return nextUser;
      });
    } catch (error) {
      console.error("Failed to pin Cluster:", error);
    }
  };

  const handleClusterUnpin = async (cluster) => {
    const clusterId = cluster?._id;

    if (!clusterId) {
      return;
    }

    closeClusterMenu();

    try {
      const response = await authFetch(
        `http://localhost:5000/api/users/pins/cluster/${clusterId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unpin Cluster");
        return;
      }

      setClusters((currentClusters) => {
        const updatedClusters = currentClusters.map((currentCluster) =>
          String(currentCluster?._id) === String(clusterId)
            ? {
                ...currentCluster,
                isPinned: false,
              }
            : currentCluster,
        );

        return [
          ...updatedClusters.filter(
            (currentCluster) => currentCluster.isPinned,
          ),
          ...updatedClusters.filter(
            (currentCluster) => !currentCluster.isPinned,
          ),
        ];
      });

      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const nextUser = {
          ...currentUser,
          pinnedClusters: (currentUser.pinnedClusters || []).filter(
            (pinnedCluster) =>
              String(pinnedCluster?._id || pinnedCluster) !== String(clusterId),
          ),
        };

        localStorage.setItem("user", JSON.stringify(nextUser));

        return nextUser;
      });
    } catch (error) {
      console.error("Failed to unpin Cluster:", error);
    }
  };

  const handleConfirmClearChat = async () => {
    const otherUserId = clearChatUser?._id;

    if (!otherUserId || isClearChatLoading) {
      return;
    }

    setIsClearChatLoading(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/messages/dm/${otherUserId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to clear chat");
        return;
      }

      const clearedConversation = findConversation(otherUserId);

      setIsClearChatConfirmOpen(false);
      setClearChatUser(null);

      if (clearedConversation) {
        onSelectChat({
          type: "dm",
          user: clearedConversation,
          isFriend: isFriend(otherUserId),
        });
      }
    } catch (error) {
      console.error("Failed to clear chat:", error);
    } finally {
      setIsClearChatLoading(false);
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

  const handleClusterMenuDeleteCluster = () => {
    const cluster = clusterMenu.cluster;

    if (!cluster?._id) {
      closeClusterMenu();
      return;
    }

    closeClusterMenu();
    onClusterMenuDeleteCluster?.(cluster);
  };

  const handleClusterMenuWipeChat = () => {
    const cluster = clusterMenu.cluster;

    if (!cluster?._id) {
      closeClusterMenu();
      return;
    }

    closeClusterMenu();
    onClusterMenuWipeChat?.(cluster);
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

  const handleGoHome = () => {
    onSelectChat?.(null);
    onSelectCluster?.(null);

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleOpenNotifications = () => {
    if (!onOpenNotifications) {
      return;
    }

    onOpenNotifications();

    if (mobile && onClose) {
      onClose();
    }
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
    if (!onOpenDiscover) {
      return;
    }

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

    setClusters((currentClusters) =>
      currentClusters.map((currentCluster) =>
        String(currentCluster?._id) === String(cluster?._id)
          ? {
              ...currentCluster,
              unreadCount: 0,
            }
          : currentCluster,
      ),
    );

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

  const hasUnreadDms = conversations.some(
    (conversation) => Number(conversation?.unreadCount) > 0,
  );

  const hasUnreadClusters = clusters.some(
    (cluster) => Number(cluster?.unreadCount) > 0,
  );

  const clearChatDisplayName =
    clearChatUser?.displayName || `@${clearChatUser?.username || "this user"}`;

  return (
    <>
      <aside
        className={`relative h-screen shrink-0 flex-col border-r border-stone-200 bg-chime-background ${
          mobile ? "flex w-full" : "hidden w-72 md:flex"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-5">
          <button
            type="button"
            onClick={handleGoHome}
            className="flex items-center gap-2 text-left"
            aria-label="Go to Chime home"
          >
            <span className="relative text-[27px] font-black uppercase tracking-[0.1em] text-chime-text">
              <span className="absolute left-0 top-1 text-chime-gold/30">
                CHIME
              </span>

              <span className="relative">
                CH<span className="text-chime-gold">I</span>ME
              </span>

              <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-chime-gold/70" />
            </span>

            <span className="text-[20px] leading-none">🔔</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNotifications}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            aria-label="Open notifications"
            title="Notifications"
          >
            <Heart size={19} />

            {notificationUnreadCount > 0 && (
              <span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-chime-gold"
                aria-label="Unread notifications"
              />
            )}
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-2">
          <div className="shrink-0">
            <SidebarSearch
              search={search}
              searchRef={searchRef}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearchChange={setSearch}
              onOpenProfile={handleOpenSearchProfile}
              onMessageUser={handleMessageSearchUser}
              onAddFriend={openSendRequestModal}
              renderPresenceIndicator={renderPresenceIndicator}
            />
          </div>

          <div className="mt-2 shrink-0 border-b border-stone-200">
            <div className="flex h-9">
              <button
                type="button"
                onClick={() => onSidebarSectionChange("dms")}
                className={`relative flex-1 px-2 text-xs font-semibold transition ${
                  sidebarSection === "dms"
                    ? "text-chime-text"
                    : "text-chime-secondary hover:text-chime-text"
                }`}
              >
                <span className="inline-flex items-center">
                  Direct Messages
                  {sidebarSection !== "dms" && hasUnreadDms && (
                    <span
                      className="ml-1.5 h-1.5 w-1.5 rounded-full bg-chime-gold"
                      aria-label="Unread direct messages"
                    />
                  )}
                </span>

                {sidebarSection === "dms" && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-chime-gold" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSidebarSectionChange("clusters")}
                className={`relative flex-1 px-2 text-xs font-semibold transition ${
                  sidebarSection === "clusters"
                    ? "text-chime-text"
                    : "text-chime-secondary hover:text-chime-text"
                }`}
              >
                <span className="inline-flex items-center">
                  Clusters
                  {sidebarSection !== "clusters" && hasUnreadClusters && (
                    <span
                      className="ml-1.5 h-1.5 w-1.5 rounded-full bg-chime-gold"
                      aria-label="Unread Cluster messages"
                    />
                  )}
                </span>

                {sidebarSection === "clusters" && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-chime-gold" />
                )}
              </button>
            </div>
          </div>

          <div className="chime-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-visible pt-4">
            {sidebarSection === "dms" ? (
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
                onClearChat={handleDmClearChat}
                onPinConversation={handleDmPin}
                onUnpinConversation={handleDmUnpin}
                renderPresenceIndicator={renderPresenceIndicator}
              />
            ) : (
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
                onClusterMenuTransferOwnership={
                  handleClusterMenuTransferOwnership
                }
                onClusterMenuDeleteCluster={handleClusterMenuDeleteCluster}
                onClusterMenuWipeChat={handleClusterMenuWipeChat}
                onClusterMenuLeave={handleClusterMenuLeave}
                onPinCluster={handleClusterPin}
                onUnpinCluster={handleClusterUnpin}
              />
            )}
          </div>

          <div className="relative z-0 shrink-0 pt-2">
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
          </div>
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

      <ConfirmModal
        isOpen={isClearChatConfirmOpen}
        title="Clear Chat?"
        message={`Are you sure you want to clear your chat with ${clearChatDisplayName}? This will only remove the conversation from your view. ${clearChatDisplayName} will still have their chat history.`}
        confirmText="Clear Chat"
        cancelText="Cancel"
        onConfirm={handleConfirmClearChat}
        onCancel={() => {
          if (!isClearChatLoading) {
            setIsClearChatConfirmOpen(false);
            setClearChatUser(null);
          }
        }}
        loading={isClearChatLoading}
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
