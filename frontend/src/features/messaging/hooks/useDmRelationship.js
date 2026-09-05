import { useEffect, useState } from "react";
import { authFetch } from "../../../shared/utils/authFetch";

function useDmRelationship({
  selectedChat,
  setIsDmMenuOpen,
  setIsOtherUserTyping,
  setReplyingTo,
  setEditingMessage,
}) {
  const [dmRelationship, setDmRelationship] = useState("friend");
  const [isRelationshipLoading, setIsRelationshipLoading] = useState(false);
  const [relationshipAction, setRelationshipAction] = useState(null);

  useEffect(() => {
    setIsRelationshipLoading(false);
    setRelationshipAction(null);

    if (!selectedChat || selectedChat.type !== "dm") {
      setDmRelationship("friend");
      return;
    }

    if (selectedChat.isBlocked) {
      setDmRelationship("blocked");
      return;
    }

    if (selectedChat.isBlockedBy) {
      setDmRelationship("blocked_by");
      return;
    }

    if (selectedChat.isFriend === false) {
      setDmRelationship("unfriended");
      return;
    }

    setDmRelationship("friend");
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat || selectedChat.type !== "dm") {
      return;
    }

    const targetUserId = selectedChat.user?._id;

    if (!targetUserId) {
      return;
    }

    let cancelled = false;

    const loadBlockedState = async () => {
      try {
        const response = await authFetch(
          "http://localhost:5000/api/friends/blocked",
        );

        const data = await response.json();

        if (cancelled || !response.ok) {
          return;
        }

        const blockedUsers = Array.isArray(data.blockedUsers)
          ? data.blockedUsers
          : [];

        const isBlocked = blockedUsers.some(
          (blockedUser) => String(blockedUser?._id) === String(targetUserId),
        );

        if (isBlocked) {
          setDmRelationship("blocked");
          return;
        }

        setDmRelationship((currentRelationship) => {
          if (currentRelationship === "blocked_by") {
            return currentRelationship;
          }

          if (selectedChat.isFriend === false) {
            return "unfriended";
          }

          return "friend";
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to check blocked users:", error);
        }
      }
    };

    loadBlockedState();

    return () => {
      cancelled = true;
    };
  }, [selectedChat]);

  const handleUnfriend = () => {
    const targetUserId = selectedChat?.user?._id;

    if (!targetUserId || isRelationshipLoading) {
      return;
    }

    setIsDmMenuOpen(false);
    setRelationshipAction("unfriend");
  };

  const handleBlock = () => {
    const targetUserId = selectedChat?.user?._id;

    if (!targetUserId || isRelationshipLoading) {
      return;
    }

    setIsDmMenuOpen(false);
    setRelationshipAction("block");
  };

  const handleConfirmRelationshipAction = async () => {
    const targetUserId = selectedChat?.user?._id;

    if (!targetUserId || isRelationshipLoading || !relationshipAction) {
      return;
    }

    setIsRelationshipLoading(true);

    try {
      const isBlocking = relationshipAction === "block";

      const response = await authFetch(
        isBlocking
          ? `http://localhost:5000/api/friends/block/${targetUserId}`
          : `http://localhost:5000/api/friends/${targetUserId}`,
        {
          method: isBlocking ? "POST" : "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          data.message ||
            (isBlocking ? "Failed to block user" : "Failed to unfriend user"),
        );
        return;
      }

      setDmRelationship(isBlocking ? "blocked" : "unfriended");
      setRelationshipAction(null);
      setIsDmMenuOpen(false);
      setIsOtherUserTyping(false);
      setReplyingTo(null);
      setEditingMessage(null);
    } catch (error) {
      console.error(
        isBlocking ? "Failed to block user:" : "Failed to unfriend user:",
        error,
      );
    } finally {
      setIsRelationshipLoading(false);
    }
  };

  const handleUnblock = async () => {
    const targetUserId = selectedChat?.user?._id;

    if (!targetUserId || isRelationshipLoading) {
      return;
    }

    setIsRelationshipLoading(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/block/${targetUserId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unblock user");
        return;
      }

      setDmRelationship("unfriended");
      setIsDmMenuOpen(false);
      setIsOtherUserTyping(false);
    } catch (error) {
      console.error("Failed to unblock user:", error);
    } finally {
      setIsRelationshipLoading(false);
    }
  };

  return {
    dmRelationship,
    setDmRelationship,
    isRelationshipLoading,
    relationshipAction,
    setRelationshipAction,
    handleUnfriend,
    handleBlock,
    handleConfirmRelationshipAction,
    handleUnblock,
  };
}

export default useDmRelationship;
