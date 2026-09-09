import { useState } from "react";

function useSidebarActions({
  setUser,
  setFriends,
  setPresence,
  setBlockedUserIds,
  setClusters,
  fetchRequests,
  fetchClusters,
  clearSearch,
  onSelectCluster,
}) {
  const [modal, setModal] = useState({
    isOpen: false,
    type: null,
    user: null,
  });

  const [isModalLoading, setIsModalLoading] = useState(false);

  const openSendRequestModal = (person) => {
    setModal({
      isOpen: true,
      type: "sendRequest",
      user: person,
    });
  };

  const openDmUnfriendModal = (user) => {
    setModal({
      isOpen: true,
      type: "dmUnfriend",
      user,
    });
  };

  const openDmBlockModal = (user) => {
    setModal({
      isOpen: true,
      type: "dmBlock",
      user,
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
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/friends/request/${modal.user._id}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message);
          return;
        }

        clearSearch();
        await fetchRequests();
      }

      if (modal.type === "dmUnfriend") {
        const userId = String(modal.user._id);

        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/friends/${userId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message || "Failed to unfriend user.");
          return;
        }

        setFriends((currentFriends) =>
          currentFriends.filter((friend) => String(friend._id) !== userId),
        );
      }

      if (modal.type === "dmBlock") {
        const blockedId = String(modal.user._id);

        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/friends/block/${blockedId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message || "Failed to block user.");
          return;
        }

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

  const handleCreateCluster = async (cluster) => {
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

  return {
    modal,
    isModalLoading,
    openSendRequestModal,
    openDmUnfriendModal,
    openDmBlockModal,
    handleLogout,
    closeModal,
    handleConfirmModal,
    handleCreateCluster,
  };
}

export default useSidebarActions;
