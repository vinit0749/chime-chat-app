import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function useChatSocket({
  user,
  selectedChatRef,
  setMessages,
  setDmRelationship,
  setIsDmMenuOpen,
  setRelationshipAction,
  setIsOtherUserTyping,
  setReplyingTo,
  setEditingMessage,
  setIsClusterMembersOpen,
  setIsClusterSettingsOpen,
  setIsClusterMenuOpen,
  setIsTransferOwnershipOpen,
  shouldAutoScrollRef,
  onClusterUpdated,
  onClusterDeleted,
  onClusterJoined,
  onClusterMemberJoined,
}) {
  const [socket, setSocket] = useState(null);

  const userRef = useRef(user);
  const onClusterUpdatedRef = useRef(onClusterUpdated);
  const onClusterDeletedRef = useRef(onClusterDeleted);
  const onClusterJoinedRef = useRef(onClusterJoined);
  const onClusterMemberJoinedRef = useRef(onClusterMemberJoined);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    onClusterUpdatedRef.current = onClusterUpdated;
  }, [onClusterUpdated]);

  useEffect(() => {
    onClusterDeletedRef.current = onClusterDeleted;
  }, [onClusterDeleted]);

  useEffect(() => {
    onClusterJoinedRef.current = onClusterJoined;
  }, [onClusterJoined]);

  useEffect(() => {
    onClusterMemberJoinedRef.current = onClusterMemberJoined;
  }, [onClusterMemberJoined]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const currentUser = userRef.current;

    if (!token || !currentUser?._id) {
      console.error("Cannot create chat socket: authentication missing.");
      return;
    }

    const newSocket = io("http://localhost:5000", {
      auth: {
        token,
      },
    });

    newSocket.on("connect", () => {
      console.log("Chat socket connected:", newSocket.id);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Chat socket connection failed:", error.message);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Chat socket disconnected:", reason);
    });

    newSocket.on("user_blocked", ({ userId }) => {
      if (!userId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (
        !currentChat ||
        currentChat.type !== "dm" ||
        String(currentChat.user?._id) !== String(userId)
      ) {
        return;
      }

      setDmRelationship("blocked");
      setIsDmMenuOpen(false);
      setRelationshipAction(null);
      setIsOtherUserTyping(false);
      setReplyingTo(null);
      setEditingMessage(null);
    });

    newSocket.on("user_blocked_by_other", ({ userId }) => {
      if (!userId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (
        !currentChat ||
        currentChat.type !== "dm" ||
        String(currentChat.user?._id) !== String(userId)
      ) {
        return;
      }

      setDmRelationship("blocked_by");
      setIsDmMenuOpen(false);
      setRelationshipAction(null);
      setIsOtherUserTyping(false);
      setReplyingTo(null);
      setEditingMessage(null);
    });

    newSocket.on("user_unblocked", ({ userId }) => {
      if (!userId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (
        !currentChat ||
        currentChat.type !== "dm" ||
        String(currentChat.user?._id) !== String(userId)
      ) {
        return;
      }

      setDmRelationship("unfriended");
    });

    newSocket.on("friend_removed", ({ userId }) => {
      if (!userId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (
        !currentChat ||
        currentChat.type !== "dm" ||
        String(currentChat.user?._id) !== String(userId)
      ) {
        return;
      }

      setDmRelationship((currentRelationship) => {
        if (
          currentRelationship === "blocked" ||
          currentRelationship === "blocked_by"
        ) {
          return currentRelationship;
        }

        return "unfriended";
      });

      setIsOtherUserTyping(false);
      setReplyingTo(null);
      setEditingMessage(null);
    });

    newSocket.on("cluster_updated", (updatedCluster) => {
      if (!updatedCluster?._id) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        String(currentChat.cluster?._id) !== String(updatedCluster._id)
      ) {
        return;
      }

      const updatedChat = {
        ...currentChat,
        cluster: {
          ...currentChat.cluster,
          ...updatedCluster,
        },
      };

      selectedChatRef.current = updatedChat;

      if (onClusterUpdatedRef.current) {
        onClusterUpdatedRef.current(updatedCluster);
      }
    });

    newSocket.on(
      "cluster_ownership_transferred",
      ({ cluster, previousOwnerId, newOwnerId }) => {
        if (!cluster?._id) {
          return;
        }

        const currentChat = selectedChatRef.current;

        if (
          !currentChat ||
          currentChat.type !== "cluster" ||
          String(currentChat.cluster?._id) !== String(cluster._id)
        ) {
          return;
        }

        const updatedCluster = {
          ...currentChat.cluster,
          ...cluster,
          owner: cluster.owner,
        };

        const updatedChat = {
          ...currentChat,
          cluster: updatedCluster,
        };

        selectedChatRef.current = updatedChat;

        setIsTransferOwnershipOpen(false);
        setIsClusterMenuOpen(false);

        if (onClusterUpdatedRef.current) {
          onClusterUpdatedRef.current(updatedCluster);
        }
      },
    );

    newSocket.on("cluster_kicked", ({ clusterId }) => {
      if (!clusterId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        String(currentChat.cluster?._id) !== String(clusterId)
      ) {
        return;
      }

      setIsClusterMembersOpen(false);
      setIsClusterSettingsOpen(false);
      setIsClusterMenuOpen(false);
      setIsTransferOwnershipOpen(false);
      setMessages([]);
      setReplyingTo(null);
      setEditingMessage(null);

      if (onClusterDeletedRef.current) {
        onClusterDeletedRef.current(String(clusterId));
      }
    });

    newSocket.on("cluster_deleted", ({ clusterId }) => {
      if (!clusterId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        String(currentChat.cluster?._id) !== String(clusterId)
      ) {
        return;
      }

      setIsClusterMembersOpen(false);
      setIsClusterSettingsOpen(false);
      setIsClusterMenuOpen(false);
      setIsTransferOwnershipOpen(false);
      setMessages([]);
      setReplyingTo(null);
      setEditingMessage(null);

      if (onClusterDeletedRef.current) {
        onClusterDeletedRef.current(String(clusterId));
      }
    });

    newSocket.on("cluster_joined_realtime", ({ cluster }) => {
      if (!cluster?._id) {
        return;
      }

      if (onClusterJoinedRef.current) {
        onClusterJoinedRef.current(cluster);
      }
    });

    newSocket.on("cluster_member_joined", (payload) => {
      const clusterId = payload?.clusterId || payload?.cluster?._id;
      const member = payload?.member || payload?.clusterMember;

      if (!clusterId) {
        return;
      }

      if (onClusterMemberJoinedRef.current) {
        onClusterMemberJoinedRef.current({
          clusterId,
          member,
          cluster: payload?.cluster || null,
        });
      }
    });

    newSocket.on("cluster_invitation_updated", (payload) => {
      const invitation =
        payload?.invitation || payload?.message || payload?.updatedMessage;

      const messageId =
        invitation?._id || payload?.messageId || payload?.invitationId;

      const status =
        invitation?.clusterInvite?.status ||
        payload?.status ||
        payload?.invitationStatus;

      if (!messageId || !status) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (!currentChat || currentChat.type !== "dm") {
        return;
      }

      const currentUserId = String(userRef.current?._id || "");
      const otherUserId = String(currentChat.user?._id || "");

      if (!currentUserId || !otherUserId) {
        return;
      }

      if (invitation?.sender && invitation?.recipient) {
        const senderId = String(invitation.sender?._id || invitation.sender);
        const recipientId = String(
          invitation.recipient?._id || invitation.recipient,
        );

        const isCurrentConversation =
          (senderId === currentUserId && recipientId === otherUserId) ||
          (senderId === otherUserId && recipientId === currentUserId);

        if (!isCurrentConversation) {
          return;
        }
      }

      shouldAutoScrollRef.current = false;

      setMessages((currentMessages) =>
        currentMessages.map((message) => {
          if (String(message._id) !== String(messageId)) {
            return message;
          }

          return {
            ...message,
            ...(invitation || {}),
            messageType: "cluster_invite",
            clusterInvite: {
              ...message.clusterInvite,
              ...(invitation?.clusterInvite || {}),
              status,
            },
          };
        }),
      );
    });

    newSocket.on("typing_start", ({ userId }) => {
      if (!userId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (!currentChat || currentChat.type !== "dm") {
        return;
      }

      if (String(userId) !== String(currentChat.user?._id)) {
        return;
      }

      setIsOtherUserTyping(true);
    });

    newSocket.on("typing_stop", ({ userId }) => {
      if (!userId) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (!currentChat || currentChat.type !== "dm") {
        return;
      }

      if (String(userId) !== String(currentChat.user?._id)) {
        return;
      }

      setIsOtherUserTyping(false);
    });

    newSocket.on("new_message", (newMessage) => {
      if (!newMessage?._id) {
        return;
      }

      const currentChat = selectedChatRef.current;
      const currentUser = userRef.current;

      if (!currentChat) {
        return;
      }

      if (
        currentChat.type === "dm" &&
        newMessage.sender &&
        String(newMessage.sender._id) === String(currentChat.user?._id)
      ) {
        setIsOtherUserTyping(false);
      }

      setMessages((currentMessages) => {
        if (
          currentMessages.some(
            (message) => String(message._id) === String(newMessage._id),
          )
        ) {
          return currentMessages;
        }

        if (currentChat.type === "cluster") {
          return currentMessages;
        }

        if (currentChat.type === "dm") {
          const currentUserId = String(currentUser._id);
          const otherUserId = String(currentChat.user?._id);

          if (!newMessage.sender || !newMessage.recipient || !otherUserId) {
            return currentMessages;
          }

          const senderId = String(newMessage.sender._id);

          const recipientId = String(
            newMessage.recipient._id || newMessage.recipient,
          );

          const isCurrentConversation =
            (senderId === currentUserId && recipientId === otherUserId) ||
            (senderId === otherUserId && recipientId === currentUserId);

          if (!isCurrentConversation) {
            return currentMessages;
          }

          let sender = newMessage.sender;

          if (senderId === currentUserId) {
            sender = {
              ...sender,
              profilePicture:
                sender.profilePicture || currentUser.profilePicture || "",
              displayName: sender.displayName || currentUser.displayName || "",
              username: sender.username || currentUser.username || "",
            };
          } else if (senderId === otherUserId) {
            sender = {
              ...sender,
              profilePicture:
                sender.profilePicture || currentChat.user.profilePicture || "",
              displayName:
                sender.displayName || currentChat.user.displayName || "",
              username: sender.username || currentChat.user.username || "",
            };
          }

          shouldAutoScrollRef.current = true;

          return [
            ...currentMessages,
            {
              ...newMessage,
              sender,
            },
          ];
        }

        return currentMessages;
      });
    });

    newSocket.on("new_cluster_message", ({ clusterId, message }) => {
      if (!message?._id || !clusterId) {
        return;
      }

      const currentChat = selectedChatRef.current;
      const currentUser = userRef.current;

      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        !currentChat.cluster?._id
      ) {
        return;
      }

      if (String(clusterId) !== String(currentChat.cluster._id)) {
        return;
      }

      setMessages((currentMessages) => {
        if (
          currentMessages.some(
            (currentMessage) =>
              String(currentMessage._id) === String(message._id),
          )
        ) {
          return currentMessages;
        }

        let normalizedMessage = message;

        if (message.sender) {
          const senderId = String(message.sender._id);

          normalizedMessage = {
            ...message,
            sender: {
              ...message.sender,
              profilePicture:
                message.sender.profilePicture ||
                (senderId === String(currentUser._id)
                  ? currentUser.profilePicture || ""
                  : ""),
              displayName:
                message.sender.displayName ||
                (senderId === String(currentUser._id)
                  ? currentUser.displayName || ""
                  : ""),
              username:
                message.sender.username ||
                (senderId === String(currentUser._id)
                  ? currentUser.username || ""
                  : ""),
            },
          };
        }

        shouldAutoScrollRef.current = true;

        return [...currentMessages, normalizedMessage];
      });
    });

    newSocket.on("message_delivered", ({ messageId }) => {
      if (!messageId) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          String(message._id) === String(messageId)
            ? {
                ...message,
                status: "delivered",
              }
            : message,
        ),
      );
    });

    newSocket.on("messages_read", ({ messageIds }) => {
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return;
      }

      const readIds = new Set(messageIds.map((id) => String(id)));

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          readIds.has(String(message._id))
            ? {
                ...message,
                status: "read",
              }
            : message,
        ),
      );
    });

    newSocket.on("message_edited", ({ messageId, content, isEdited }) => {
      if (!messageId) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          String(message._id) === String(messageId)
            ? {
                ...message,
                content,
                isEdited: isEdited ?? true,
              }
            : message,
        ),
      );
    });

    newSocket.on("message_unsent", ({ messageId }) => {
      if (!messageId) {
        return;
      }

      shouldAutoScrollRef.current = false;

      setMessages((currentMessages) =>
        currentMessages.filter(
          (message) => String(message._id) !== String(messageId),
        ),
      );

      setReplyingTo((currentReply) =>
        currentReply && String(currentReply._id) === String(messageId)
          ? null
          : currentReply,
      );

      setEditingMessage((currentEdit) =>
        currentEdit && String(currentEdit._id) === String(messageId)
          ? null
          : currentEdit,
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user?._id]);

  return socket;
}

export default useChatSocket;
