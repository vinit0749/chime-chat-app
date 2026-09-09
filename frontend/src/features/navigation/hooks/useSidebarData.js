import { useEffect } from "react";
import { authFetch } from "../../../shared/utils/authFetch";

function useSidebarData({
  setUser,
  setFriends,
  setConversations,
  setRequests,
  setClusters,
  setBlockedUserIds,
  setLoadingConversations,
  setLoadingClusters,
}) {
  const fetchCurrentUser = async () => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/me`);

      if (response.status === 401) {
        return null;
      }

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);

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

        return data.user;
      }

      return null;
    } catch (error) {
      console.error("Failed to load current user:", error);
      return null;
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/friends`);

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
    }
  };

  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  };

  const getPinnedIds = (items = []) => {
    return new Map(
      items.map((item, index) => [String(item?._id || item), index]),
    );
  };

  const orderPinnedItems = (items, pinnedItems) => {
    const pinnedOrder = getPinnedIds(pinnedItems);

    const orderedItems = items.map((item) => ({
      ...item,
      isPinned: pinnedOrder.has(String(item._id)),
    }));

    const pinned = [];
    const unpinned = [];

    orderedItems.forEach((item) => {
      if (item.isPinned) {
        pinned.push(item);
      } else {
        unpinned.push(item);
      }
    });

    pinned.sort(
      (a, b) => pinnedOrder.get(String(a._id)) - pinnedOrder.get(String(b._id)),
    );

    return [...pinned, ...unpinned];
  };

  const fetchConversations = async (currentUser = null) => {
    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/messages/dms`,
      );

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        const user = currentUser || getStoredUser();

        const conversations = orderPinnedItems(
          data.conversations || [],
          user?.pinnedDMs || [],
        );

        setConversations(conversations);
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
        `${import.meta.env.VITE_BACKEND_URL}/api/friends/requests`,
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

  const fetchClusters = async (currentUser = null) => {
    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/clusters/mine`,
      );

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        const user = currentUser || getStoredUser();

        const clusters = orderPinnedItems(
          data.clusters || [],
          user?.pinnedClusters || [],
        );

        setClusters(clusters);
      }
    } catch (error) {
      console.error("Failed to load Clusters:", error);
    } finally {
      setLoadingClusters(false);
    }
  };

  useEffect(() => {
    const loadSidebarData = async () => {
      const currentUser = await fetchCurrentUser();

      await Promise.all([
        fetchFriends(),
        fetchConversations(currentUser),
        fetchRequests(),
        fetchClusters(currentUser),
      ]);
    };

    loadSidebarData();
  }, []);

  return {
    fetchCurrentUser,
    fetchFriends,
    fetchConversations,
    fetchRequests,
    fetchClusters,
  };
}

export default useSidebarData;
