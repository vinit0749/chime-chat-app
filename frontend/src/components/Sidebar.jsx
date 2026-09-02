import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  X,
  Search,
  UserPlus,
  Check,
  Clock,
  LogOut,
  Users,
  MessageCircle,
  Compass,
  Plus,
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import ConfirmModal from "./ConfirmModal";
import CreateClusterModal from "./CreateClusterModal";
import DmContextMenu from "./DmContextMenu";

function Sidebar({
  mobile = false,
  onClose,
  onSelectChat,
  onSelectCluster,
  onOpenDiscover,
  onOpenFriendRequests,
  onOpenProfile,
  onOpenUserProfile,
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

  /*
    Users currently blocked by the current user.
  */
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

  /*
    Users who have blocked the current user.

    This is realtime state because the backend does not provide a
    persistent "users who blocked me" list.
  */
  const [blockedByUserIds, setBlockedByUserIds] = useState(new Set());

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(true);

  const [modal, setModal] = useState({
    isOpen: false,
    type: null,
    user: null,
  });

  const [isModalLoading, setIsModalLoading] = useState(false);

  /*
    DM contextual menu.
  */
  const [dmMenu, setDmMenu] = useState({
    isOpen: false,
    user: null,
  });

  const dmLongPressTimer = useRef(null);
  const searchRef = useRef(null);

  const [isCreateClusterModalOpen, setIsCreateClusterModalOpen] =
    useState(false);

  /*
    ------------------------------------------------------------
    CURRENT USER
    ------------------------------------------------------------
  */

  const fetchCurrentUser = async () => {
    try {
      const response = await authFetch("http://localhost:5000/api/users/me");

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);

        /*
          Sync the backend blocked list on initial load.

          IMPORTANT:
          We no longer poll /me every 2 seconds. This prevents an
          in-flight stale request from overwriting realtime block state.
        */
        const backendBlockedIds = new Set(
          (data.user.blockedUsers || [])
            .map((blockedUser) => blockedUser?._id || blockedUser)
            .filter(Boolean)
            .map(String),
        );

        setBlockedUserIds(backendBlockedIds);

        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...storedUser,
            ...data.user,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await authFetch("http://localhost:5000/api/friends");

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/messages/dms",
      );

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/friends/requests",
      );

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Failed to load friend requests:", error);
    }
  };

  const fetchClusters = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/clusters/mine",
      );

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setClusters(data.clusters || []);
      }
    } catch (error) {
      console.error("Failed to load Clusters:", error);
    } finally {
      setLoadingClusters(false);
    }
  };

  /*
    Initial data load.

    We intentionally DO NOT poll /users/me anymore because relationship
    changes are already delivered through Socket.IO.
  */
  useEffect(() => {
    fetchCurrentUser();
    fetchFriends();
    fetchConversations();
    fetchRequests();
    fetchClusters();

    /*
      Keep the existing refresh behavior for data that can change
      independently, but do not refresh /me because that can race
      with realtime block/unblock state.
    */
    const interval = setInterval(() => {
      fetchFriends();
      fetchConversations();
      fetchRequests();
      fetchClusters();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  /*
    ------------------------------------------------------------
    SOCKET.IO
    ------------------------------------------------------------
  */

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: {
        token,
      },
    });

    /*
      ----------------------------------------------------------
      PRESENCE
      ----------------------------------------------------------
    */

    socket.on("presence_update", (data) => {
      if (!data?.userId) return;

      const userId = String(data.userId);

      /*
        Never store online/away presence for a blocked relationship.
      */
      setBlockedUserIds((currentBlockedIds) => {
        if (currentBlockedIds.has(userId)) {
          setPresence((currentPresence) => ({
            ...currentPresence,
            [userId]: "offline",
          }));

          return currentBlockedIds;
        }

        return currentBlockedIds;
      });

      setBlockedByUserIds((currentBlockedByIds) => {
        if (currentBlockedByIds.has(userId)) {
          setPresence((currentPresence) => ({
            ...currentPresence,
            [userId]: "offline",
          }));

          return currentBlockedByIds;
        }

        setPresence((currentPresence) => ({
          ...currentPresence,
          [userId]: data.status,
        }));

        return currentBlockedByIds;
      });
    });

    socket.on("presence_initial", (users) => {
      if (!Array.isArray(users)) return;

      setPresence((currentPresence) => {
        const nextPresence = { ...currentPresence };

        users.forEach((item) => {
          if (!item?.userId) return;

          const userId = String(item.userId);

          if (blockedUserIds.has(userId) || blockedByUserIds.has(userId)) {
            nextPresence[userId] = "offline";
            return;
          }

          nextPresence[userId] = item.status;
        });

        return nextPresence;
      });
    });

    /*
      ----------------------------------------------------------
      FRIEND REQUEST RECEIVED
      ----------------------------------------------------------
    */

    socket.on("friend_request_received", (data) => {
      if (!data) return;

      const request = data.request || data;

      if (!request?._id && !request?.requester) {
        fetchRequests();
        return;
      }

      setRequests((currentRequests) => {
        const requestId = String(
          request._id || request.requester?._id || request.requester || "",
        );

        const alreadyExists = currentRequests.some(
          (item) =>
            String(item._id || item.requester?._id || item.requester || "") ===
            requestId,
        );

        if (alreadyExists) {
          return currentRequests;
        }

        return [...currentRequests, request];
      });
    });

    /*
      ----------------------------------------------------------
      FRIEND REQUEST ACCEPTED
      ----------------------------------------------------------
    */

    socket.on("friend_request_accepted", (data) => {
      if (!data) return;

      const friend = data.friend || data.user;

      if (friend?._id) {
        setFriends((currentFriends) => {
          const exists = currentFriends.some(
            (item) => String(item._id) === String(friend._id),
          );

          if (exists) {
            return currentFriends;
          }

          return [...currentFriends, friend];
        });
      }

      setRequests((currentRequests) =>
        currentRequests.filter((request) => {
          const requesterId = String(
            request.requester?._id || request.requester || "",
          );

          const recipientId = String(
            request.recipient?._id || request.recipient || "",
          );

          const acceptedUserId = String(data.userId || friend?._id || "");

          return (
            requesterId !== acceptedUserId && recipientId !== acceptedUserId
          );
        }),
      );
    });

    /*
      ----------------------------------------------------------
      FRIEND REQUEST REJECTED
      ----------------------------------------------------------
    */

    socket.on("friend_request_rejected", (data) => {
      if (!data) return;

      const rejectedUserId = String(
        data.userId || data.requesterId || data.recipientId || "",
      );

      if (!rejectedUserId) {
        fetchRequests();
        return;
      }

      setRequests((currentRequests) =>
        currentRequests.filter((request) => {
          const requesterId = String(
            request.requester?._id || request.requester || "",
          );

          const recipientId = String(
            request.recipient?._id || request.recipient || "",
          );

          return (
            requesterId !== rejectedUserId && recipientId !== rejectedUserId
          );
        }),
      );
    });

    /*
      ----------------------------------------------------------
      FRIEND REMOVED
      ----------------------------------------------------------
    */

    socket.on("friend_removed", (data) => {
      if (!data) return;

      const removedUserId = String(
        data.userId || data.friendId || data.removedUserId || "",
      );

      if (!removedUserId) {
        fetchFriends();
        return;
      }

      setFriends((currentFriends) =>
        currentFriends.filter((friend) => String(friend._id) !== removedUserId),
      );
    });

    /*
      ----------------------------------------------------------
      USER BLOCKED
      ----------------------------------------------------------
    */

    socket.on("user_blocked", (data) => {
      if (!data) return;

      const blockedId = String(
        data.userId || data.blockedUserId || data.targetUserId || "",
      );

      if (!blockedId) {
        fetchCurrentUser();
        fetchFriends();
        return;
      }

      setBlockedUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(blockedId);
        return nextIds;
      });

      /*
        IMPORTANT:
        Keep Sidebar's current user state synchronized when the block
        happens from another component, such as ChatArea.
      */
      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const existingBlocked = (currentUser.blockedUsers || [])
          .map((blockedUser) => blockedUser?._id || blockedUser)
          .map(String);

        const nextBlockedUsers = existingBlocked.includes(blockedId)
          ? existingBlocked
          : [...existingBlocked, blockedId];

        const nextUser = {
          ...currentUser,
          blockedUsers: nextBlockedUsers,
        };

        localStorage.setItem("user", JSON.stringify(nextUser));

        return nextUser;
      });

      setPresence((currentPresence) => ({
        ...currentPresence,
        [blockedId]: "offline",
      }));

      setFriends((currentFriends) =>
        currentFriends.filter((friend) => String(friend._id) !== blockedId),
      );

      setDmMenu((currentMenu) => {
        if (String(currentMenu.user?._id) === blockedId) {
          return {
            isOpen: false,
            user: null,
          };
        }

        return currentMenu;
      });
    });

    /*
      ----------------------------------------------------------
      USER BLOCKED BY OTHER
      ----------------------------------------------------------
    */

    socket.on("user_blocked_by_other", (data) => {
      if (!data) return;

      const blockerId = String(
        data.userId || data.blockerId || data.blockedByUserId || "",
      );

      if (!blockerId) {
        return;
      }

      setBlockedByUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(blockerId);
        return nextIds;
      });

      setFriends((currentFriends) =>
        currentFriends.filter((friend) => String(friend._id) !== blockerId),
      );

      setPresence((currentPresence) => ({
        ...currentPresence,
        [blockerId]: "offline",
      }));

      setDmMenu((currentMenu) => {
        if (String(currentMenu.user?._id) === blockerId) {
          return {
            isOpen: false,
            user: null,
          };
        }

        return currentMenu;
      });
    });

    /*
      ----------------------------------------------------------
      USER UNBLOCKED
      ----------------------------------------------------------
    */

    socket.on("user_unblocked", (data) => {
      if (!data) return;

      const unblockedId = String(
        data.userId || data.unblockedUserId || data.targetUserId || "",
      );

      if (!unblockedId) {
        fetchCurrentUser();
        return;
      }

      setBlockedUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(unblockedId);
        return nextIds;
      });

      setBlockedByUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(unblockedId);
        return nextIds;
      });

      setPresence((currentPresence) => {
        const nextPresence = { ...currentPresence };
        delete nextPresence[unblockedId];
        return nextPresence;
      });
    });

    /*
      ----------------------------------------------------------
      CLUSTERS
      ----------------------------------------------------------
    */

    socket.on("cluster_created", fetchClusters);
    socket.on("cluster_joined", fetchClusters);
    socket.on("cluster_left", fetchClusters);
    socket.on("cluster_membership_updated", fetchClusters);
    socket.on("cluster_membership_changed", fetchClusters);

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  /*
    ------------------------------------------------------------
    SEARCH CLICK OUTSIDE / ESCAPE
    ------------------------------------------------------------
  */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearch("");
        setSearchResults([]);
      }

      if (!event.target.closest?.('[data-dm-context-menu="true"]')) {
        setDmMenu({
          isOpen: false,
          user: null,
        });
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSearch("");
        setSearchResults([]);

        setDmMenu({
          isOpen: false,
          user: null,
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  /*
    ------------------------------------------------------------
    USER SEARCH
    ------------------------------------------------------------
  */

  useEffect(() => {
    const searchUsers = async () => {
      if (!search.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const response = await authFetch(
          `http://localhost:5000/api/users/search?q=${encodeURIComponent(
            search.trim(),
          )}`,
        );

        if (response.status === 401) return;

        const data = await response.json();

        if (response.ok) {
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error("User search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(searchUsers, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  /*
    ------------------------------------------------------------
    MODALS
    ------------------------------------------------------------
  */

  const openSendRequestModal = (person) => {
    setModal({
      isOpen: true,
      type: "sendRequest",
      user: person,
    });
  };

  const handleLogout = () => {
    setModal({
      isOpen: true,
      type: "logout",
      user: null,
    });
  };

  const closeModal = () => {
    if (isModalLoading) return;

    setModal({
      isOpen: false,
      type: null,
      user: null,
    });
  };

  const handleConfirmModal = async () => {
    if (modal.type !== "logout" && !modal.user) return;

    setIsModalLoading(true);

    try {
      if (modal.type === "logout") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/login";
        return;
      }

      if (modal.type === "sendRequest") {
        const response = await authFetch(
          `http://localhost:5000/api/friends/request/${modal.user._id}`,
          {
            method: "POST",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message);
          return;
        }

        setSearch("");
        setSearchResults([]);

        await fetchRequests();
      }

      if (modal.type === "dmUnfriend") {
        const userId = String(modal.user._id);

        const response = await authFetch(
          `http://localhost:5000/api/friends/${userId}`,
          {
            method: "DELETE",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message || "Failed to unfriend user.");
          return;
        }

        /*
          Immediate Sidebar update.
        */
        setFriends((currentFriends) =>
          currentFriends.filter((friend) => String(friend._id) !== userId),
        );
      }

      if (modal.type === "dmBlock") {
        const blockedId = String(modal.user._id);

        const response = await authFetch(
          `http://localhost:5000/api/friends/block/${blockedId}`,
          {
            method: "POST",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message || "Failed to block user.");
          return;
        }

        /*
          Immediately update blocked state.
        */
        setBlockedUserIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(blockedId);
          return nextIds;
        });

        setPresence((currentPresence) => ({
          ...currentPresence,
          [blockedId]: "offline",
        }));

        setFriends((currentFriends) =>
          currentFriends.filter((friend) => String(friend._id) !== blockedId),
        );

        /*
          Keep localStorage synchronized immediately.
        */
        setUser((currentUser) => {
          if (!currentUser) {
            return currentUser;
          }

          const existingBlocked = (currentUser.blockedUsers || [])
            .map((blockedUser) => blockedUser?._id || blockedUser)
            .map(String);

          const nextBlockedUsers = existingBlocked.includes(blockedId)
            ? existingBlocked
            : [...existingBlocked, blockedId];

          const nextUser = {
            ...currentUser,
            blockedUsers: nextBlockedUsers,
          };

          localStorage.setItem("user", JSON.stringify(nextUser));

          return nextUser;
        });
      }

      setModal({
        isOpen: false,
        type: null,
        user: null,
      });
    } catch (error) {
      if (modal.type === "sendRequest") {
        console.error("Failed to send friend request:", error);
      }

      if (modal.type === "dmUnfriend") {
        console.error("Failed to unfriend user:", error);
      }

      if (modal.type === "dmBlock") {
        console.error("Failed to block user:", error);
      }
    } finally {
      setIsModalLoading(false);
    }
  };

  /*
    ------------------------------------------------------------
    CREATE CLUSTER
    ------------------------------------------------------------
  */

  const handleCreateCluster = async (cluster) => {
    setIsCreateClusterModalOpen(false);

    setClusters((currentClusters) => {
      const exists = currentClusters.some(
        (item) => String(item._id) === String(cluster?._id),
      );

      if (exists) {
        return currentClusters;
      }

      return [...currentClusters, cluster];
    });

    await fetchClusters();

    if (cluster?._id && onSelectCluster) {
      onSelectCluster(cluster);
    }
  };

  /*
    ------------------------------------------------------------
    HELPERS
    ------------------------------------------------------------
  */

  const isFriend = (userId) => {
    return friends.some((friend) => String(friend._id) === String(userId));
  };

  const findConversation = (userId) => {
    return conversations.find(
      (conversation) => String(conversation._id) === String(userId),
    );
  };

  /*
    A user is considered presence-hidden if either side has blocked
    the other.
  */
  const isPresenceHidden = (userId) => {
    if (!userId) return false;

    const normalizedUserId = String(userId);

    return (
      blockedUserIds.has(normalizedUserId) ||
      blockedByUserIds.has(normalizedUserId)
    );
  };

  /*
    Final defensive presence lookup.
  */
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

  /*
    ------------------------------------------------------------
    DM CONTEXT MENU
    ------------------------------------------------------------
  */

  const openDmMenu = (conversation, event) => {
    event.preventDefault();
    event.stopPropagation();

    setDmMenu({
      isOpen: true,
      user: conversation,
    });
  };

  const startDmLongPress = (conversation) => {
    clearTimeout(dmLongPressTimer.current);

    dmLongPressTimer.current = setTimeout(() => {
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

    setModal({
      isOpen: true,
      type: "dmUnfriend",
      user: conversation,
    });

    closeDmMenu();
  };

  const handleDmBlock = () => {
    const conversation = dmMenu.user;

    if (!conversation?._id) {
      return;
    }

    setModal({
      isOpen: true,
      type: "dmBlock",
      user: conversation,
    });

    closeDmMenu();
  };

  /*
    Unblock is immediate.

    Unblocking does NOT restore the friendship.
  */
  const handleDmUnblock = async () => {
    const conversation = dmMenu.user;

    if (!conversation?._id) {
      return;
    }

    const unblockedId = String(conversation._id);

    closeDmMenu();

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/block/${unblockedId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unblock user.");
        return;
      }

      /*
        Immediate local state update.
      */
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

      /*
        Keep localStorage synchronized immediately.
      */
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

  /*
    ------------------------------------------------------------
    CHAT SELECTION
    ------------------------------------------------------------
  */

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

  const handleOpenSearchProfile = (person) => {
    if (!person?._id || !onOpenUserProfile) return;

    onOpenUserProfile(person._id);

    setSearch("");
    setSearchResults([]);

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleMessageSearchUser = (person) => {
    if (!person?._id) return;

    const conversation = findConversation(person._id);
    const chatUser = conversation || person;

    onSelectChat({
      type: "dm",
      user: chatUser,
      isFriend: isFriend(person._id),
    });

    setSearch("");
    setSearchResults([]);

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

  /*
    ------------------------------------------------------------
    RELATIONSHIP BUTTON
    ------------------------------------------------------------
  */

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

  /*
    ------------------------------------------------------------
    PRESENCE INDICATOR
    ------------------------------------------------------------
  */

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
          <div ref={searchRef} className="relative mb-6">
            <div className="flex items-center rounded-xl border border-stone-200 bg-chime-chat px-3">
              <Search size={17} className="shrink-0 text-chime-secondary" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find people..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-chime-text outline-none placeholder:text-chime-secondary"
              />
            </div>

            {search.trim() && (
              <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-xl border border-stone-200 bg-chime-background shadow-lg">
                {isSearching ? (
                  <p className="px-4 py-3 text-sm text-chime-secondary">
                    Searching...
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-chime-secondary">
                    No users found
                  </p>
                ) : (
                  searchResults.map((person) => (
                    <div
                      key={person._id}
                      className="flex items-center gap-2 px-3 py-3 transition hover:bg-chime-selected"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenSearchProfile(person)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        title="View profile"
                      >
                        <div className="relative h-9 w-9 shrink-0">
                          {person.profilePicture ? (
                            <img
                              src={person.profilePicture}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-chime-gold" />
                          )}

                          {renderPresenceIndicator(person._id)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-chime-text hover:underline">
                            {person.displayName || `@${person.username}`}
                          </p>

                          {person.displayName && (
                            <p className="truncate text-xs text-chime-secondary">
                              @{person.username}
                            </p>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMessageSearchUser(person);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-gold hover:text-chime-text"
                        title={`Message ${
                          person.displayName || `@${person.username}`
                        }`}
                        aria-label={`Message ${
                          person.displayName || person.username
                        }`}
                      >
                        <MessageCircle size={16} />
                      </button>

                      {renderRelationshipButton(person)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-chime-secondary">
              Direct Messages
            </h2>

            {loadingConversations ? (
              <p className="px-2 py-2 text-sm text-chime-secondary">
                Loading...
              </p>
            ) : conversations.length === 0 ? (
              <p className="px-2 py-2 text-sm leading-5 text-chime-secondary">
                No conversations yet.
                <br />
                Search for someone above to get started.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => {
                  const conversationId = String(conversation._id);

                  const isMenuTarget =
                    dmMenu.isOpen &&
                    String(dmMenu.user?._id) === conversationId;

                  const isBlockedByMe = blockedUserIds.has(conversationId);

                  const isBlockedByOther = blockedByUserIds.has(conversationId);

                  return (
                    <div
                      key={conversation._id}
                      className="relative"
                      onContextMenu={(event) => openDmMenu(conversation, event)}
                      onTouchStart={() => startDmLongPress(conversation)}
                      onTouchEnd={cancelDmLongPress}
                      onTouchMove={cancelDmLongPress}
                      onTouchCancel={cancelDmLongPress}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isMenuTarget) {
                            closeDmMenu();
                            return;
                          }

                          handleSelectConversation(conversation);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition hover:bg-chime-selected"
                      >
                        <div className="relative h-10 w-10 shrink-0">
                          {conversation.profilePicture ? (
                            <img
                              src={conversation.profilePicture}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-chime-gold" />
                          )}

                          {renderPresenceIndicator(conversation._id)}
                        </div>

                        <span className="min-w-0 flex-1 truncate">
                          {conversation.displayName ||
                            `@${conversation.username}`}
                        </span>
                      </button>

                      {isMenuTarget && (
                        <DmContextMenu
                          user={conversation}
                          onViewProfile={handleDmViewProfile}
                          onUnfriend={handleDmUnfriend}
                          onBlock={handleDmBlock}
                          onUnblock={handleDmUnblock}
                          showUnfriend={isFriend(conversation._id)}
                          showBlock={!isBlockedByMe && !isBlockedByOther}
                          showUnblock={isBlockedByMe}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-chime-secondary">
                Clusters
              </h2>

              <button
                type="button"
                onClick={() => setIsCreateClusterModalOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
                title="Create or join a Cluster"
                aria-label="Create or join a Cluster"
              >
                <Plus size={16} />
              </button>
            </div>

            {loadingClusters ? (
              <p className="px-2 py-2 text-sm text-chime-secondary">
                Loading...
              </p>
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
                      {publicClusters.map((cluster) => (
                        <button
                          key={cluster._id}
                          type="button"
                          onClick={() => handleSelectCluster(cluster)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition ${
                            activeView === `cluster-${cluster._id}`
                              ? "bg-chime-selected"
                              : "hover:bg-chime-selected"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-gold text-sm font-bold text-chime-text">
                            {getClusterInitial(cluster)}
                          </div>

                          <span className="min-w-0 flex-1 truncate">
                            {cluster.name || "Unnamed Cluster"}
                          </span>
                        </button>
                      ))}
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
                      {privateClusters.map((cluster) => (
                        <button
                          key={cluster._id}
                          type="button"
                          onClick={() => handleSelectCluster(cluster)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition ${
                            activeView === `cluster-${cluster._id}`
                              ? "bg-chime-selected"
                              : "hover:bg-chime-selected"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-sm font-bold text-chime-text">
                            {getClusterInitial(cluster)}
                          </div>

                          <span className="min-w-0 flex-1 truncate">
                            {cluster.name || "Unnamed Cluster"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto space-y-2 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={handleDiscoverClusters}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                activeView === "discover"
                  ? "bg-chime-selected text-chime-text"
                  : "text-chime-text hover:bg-chime-selected"
              }`}
            >
              <Compass
                size={18}
                className={
                  activeView === "discover"
                    ? "text-chime-text"
                    : "text-chime-secondary"
                }
              />

              <span className="min-w-0 flex-1 truncate">Discover</span>
            </button>

            <button
              type="button"
              onClick={handleOpenFriends}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                activeView === "friends"
                  ? "bg-chime-selected text-chime-text"
                  : "text-chime-text hover:bg-chime-selected"
              }`}
            >
              <Users
                size={18}
                className={
                  activeView === "friends"
                    ? "text-chime-text"
                    : "text-chime-secondary"
                }
              />

              <span className="min-w-0 flex-1 truncate">Friends</span>

              {requests.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chime-gold px-1.5 text-xs font-bold text-chime-text">
                  {requests.length}
                </span>
              )}
            </button>
          </div>
        </nav>

        <div className="shrink-0 border-t border-stone-200 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenProfile}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition ${
                activeView === "profile"
                  ? "bg-chime-selected"
                  : "hover:bg-chime-selected"
              }`}
              title="Open profile"
            >
              <div className="relative h-12 w-12 shrink-0">
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-chime-gold" />
                )}

                {user?._id && renderPresenceIndicator(user._id)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-chime-text">
                  {user?.displayName || `@${user?.username || "user"}`}
                </p>

                {user?.displayName && (
                  <p className="truncate text-xs text-chime-secondary">
                    @{user?.username || "user"}
                  </p>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-lg p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
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
