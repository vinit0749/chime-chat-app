import { useEffect } from "react";
import { authFetch } from "../utils/authFetch";

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
      const response = await authFetch("http://localhost:5000/api/users/me");

      if (response.status === 401) return;

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

  useEffect(() => {
    fetchCurrentUser();
    fetchFriends();
    fetchConversations();
    fetchRequests();
    fetchClusters();

    const interval = setInterval(() => {
      fetchFriends();
      fetchConversations();
      fetchRequests();
    }, 2000);

    return () => clearInterval(interval);
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
