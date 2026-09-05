import { useEffect, useRef, useState } from "react";
import { MessageCircle, MoreVertical, Bell } from "lucide-react";
import Message from "../Message";
import ClusterInvitationMessage from "../ClusterInvitationMessage";
import MessageInput from "../MessageInput";
import ClusterMembersPanel from "../../../clusters/components/ClusterMembersPanel";
import ClusterSettingsPanel from "../../../clusters/components/ClusterSettingsPanel";
import ClusterInfoPanel from "../../../clusters/components/ClusterInfoPanel";
import ClusterContextMenu from "../../../clusters/components/ClusterContextMenu";
import TransferOwnershipPanel from "../../../clusters/components/TransferOwnershipPanel";
import DmContextMenu from "../DmContextMenu";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import { usePresence } from "../../../../shared/context/PresenceContext";
import useChatSocket from "../../hooks/useChatSocket";
import useChatMessages from "../../hooks/useChatMessages";
import useDmRelationship from "../../hooks/useDmRelationship";
import { authFetch } from "../../../../shared/utils/authFetch";

function ChatArea({
  selectedChat,
  onOpenProfile,
  onOpenOwnProfile,
  onSelectChat,
  onClusterUpdated,
  onClusterDeleted,
  onClusterLeft,
  clusterMenuAction,
  onClusterMenuActionHandled,
}) {
  const user = JSON.parse(localStorage.getItem("user"));
  const { getPresence } = usePresence();

  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [clusterTypingUsers, setClusterTypingUsers] = useState(new Map());
  const [isClusterMembersOpen, setIsClusterMembersOpen] = useState(false);
  const [isClusterSettingsOpen, setIsClusterSettingsOpen] = useState(false);
  const [isClusterInfoOpen, setIsClusterInfoOpen] = useState(false);
  const [isClusterMenuOpen, setIsClusterMenuOpen] = useState(false);
  const [isTransferOwnershipOpen, setIsTransferOwnershipOpen] = useState(false);
  const [isDmMenuOpen, setIsDmMenuOpen] = useState(false);
  const [isClearChatConfirmOpen, setIsClearChatConfirmOpen] = useState(false);
  const [isClearChatLoading, setIsClearChatLoading] = useState(false);
  const [isLeaveClusterConfirmOpen, setIsLeaveClusterConfirmOpen] =
    useState(false);
  const [isLeaveClusterLoading, setIsLeaveClusterLoading] = useState(false);
  const [isDeleteClusterConfirmOpen, setIsDeleteClusterConfirmOpen] =
    useState(false);
  const [isDeleteClusterLoading, setIsDeleteClusterLoading] = useState(false);
  const [isWipeChatConfirmOpen, setIsWipeChatConfirmOpen] = useState(false);
  const [isWipeChatLoading, setIsWipeChatLoading] = useState(false);
  const [respondingInvitationId, setRespondingInvitationId] = useState(null);

  const dmMenuRef = useRef(null);
  const clusterMenuRef = useRef(null);

  const {
    messages,
    setMessages,
    isLoading,
    messagesEndRef,
    messagesContainerRef,
    selectedChatRef,
    shouldAutoScrollRef,
    handleJumpToMessage,
  } = useChatMessages({
    selectedChat,
    user,
  });

  const {
    dmRelationship,
    setDmRelationship,
    isRelationshipLoading,
    relationshipAction,
    setRelationshipAction,
    handleUnfriend,
    handleBlock,
    handleConfirmRelationshipAction,
    handleUnblock,
  } = useDmRelationship({
    selectedChat,
    setIsDmMenuOpen,
    setIsOtherUserTyping,
    setReplyingTo,
    setEditingMessage,
  });

  useEffect(() => {
    setIsOtherUserTyping(false);
    setClusterTypingUsers(new Map());
    setReplyingTo(null);
    setEditingMessage(null);
    setIsClusterMembersOpen(false);
    setIsClusterSettingsOpen(false);
    setIsClusterInfoOpen(false);
    setIsClusterMenuOpen(false);
    setIsTransferOwnershipOpen(false);
    setIsDmMenuOpen(false);
    setIsClearChatConfirmOpen(false);
    setIsClearChatLoading(false);
    setIsLeaveClusterConfirmOpen(false);
    setIsLeaveClusterLoading(false);
    setIsDeleteClusterConfirmOpen(false);
    setIsDeleteClusterLoading(false);
    setIsWipeChatConfirmOpen(false);
    setIsWipeChatLoading(false);
    setRespondingInvitationId(null);
    shouldAutoScrollRef.current = false;
  }, [selectedChat, shouldAutoScrollRef]);

  useEffect(() => {
    if (
      !clusterMenuAction ||
      !selectedChat ||
      selectedChat.type !== "cluster"
    ) {
      return;
    }

    if (
      String(selectedChat.cluster?._id) !== String(clusterMenuAction.clusterId)
    ) {
      return;
    }

    setIsClusterMenuOpen(false);

    if (clusterMenuAction.action === "members") {
      setIsClusterMembersOpen(true);
    }

    if (clusterMenuAction.action === "settings") {
      setIsClusterSettingsOpen(true);
    }

    if (clusterMenuAction.action === "transfer") {
      setIsTransferOwnershipOpen(true);
    }

    if (clusterMenuAction.action === "info") {
      setIsClusterInfoOpen(true);
    }

    if (clusterMenuAction.action === "leave") {
      setIsLeaveClusterConfirmOpen(true);
    }

    if (clusterMenuAction.action === "delete") {
      setIsDeleteClusterConfirmOpen(true);
    }

    if (clusterMenuAction.action === "wipe") {
      setIsWipeChatConfirmOpen(true);
    }

    onClusterMenuActionHandled?.();
  }, [clusterMenuAction, selectedChat, onClusterMenuActionHandled]);

  useEffect(() => {
    if (!isDmMenuOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!dmMenuRef.current?.contains(event.target)) {
        setIsDmMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isDmMenuOpen]);

  useEffect(() => {
    if (!isClusterMenuOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!clusterMenuRef.current?.contains(event.target)) {
        setIsClusterMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isClusterMenuOpen]);

  const socket = useChatSocket({
    user,
    selectedChatRef,
    setMessages,
    setDmRelationship,
    setIsDmMenuOpen,
    setRelationshipAction,
    setIsOtherUserTyping,
    setClusterTypingUsers,
    setReplyingTo,
    setEditingMessage,
    setIsClusterMembersOpen,
    setIsClusterSettingsOpen,
    setIsClusterMenuOpen,
    setIsTransferOwnershipOpen,
    shouldAutoScrollRef,
    onClusterUpdated,
    onClusterDeleted,
  });

  useEffect(() => {
    if (!socket || !selectedChat) {
      return;
    }

    if (selectedChat.type !== "cluster" || !selectedChat.cluster?._id) {
      return;
    }

    const clusterId = String(selectedChat.cluster._id);

    const joinCluster = () => {
      socket.emit("join_cluster", {
        clusterId,
      });
    };

    if (socket.connected) {
      joinCluster();
    } else {
      socket.once("connect", joinCluster);
    }

    return () => {
      socket.off("connect", joinCluster);

      if (socket.connected) {
        socket.emit("leave_cluster", {
          clusterId,
        });
      }
    };
  }, [socket, selectedChat]);

  useEffect(() => {
    if (!socket || !selectedChat || selectedChat.type !== "cluster") {
      return;
    }

    const handleClusterMessageRead = ({ clusterId, messageId }) => {
      if (
        !clusterId ||
        !messageId ||
        String(selectedChat.cluster?._id) !== String(clusterId)
      ) {
        return;
      }

      const container = messagesContainerRef.current;

      if (!container) {
        return;
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      if (distanceFromBottom > 150) {
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const currentContainer = messagesContainerRef.current;

          if (!currentContainer) {
            return;
          }

          currentContainer.scrollTo({
            top: currentContainer.scrollHeight,
            behavior: "smooth",
          });
        });
      });
    };

    socket.on("cluster_message_read", handleClusterMessageRead);

    return () => {
      socket.off("cluster_message_read", handleClusterMessageRead);
    };
  }, [socket, selectedChat, messagesContainerRef]);

  useEffect(() => {
    if (
      !socket ||
      !socket.connected ||
      !selectedChat ||
      selectedChat.type !== "dm" ||
      dmRelationship !== "friend" ||
      messages.length === 0
    ) {
      return;
    }

    const senderId = selectedChat.user?._id;

    if (!senderId) {
      return;
    }

    const hasUnreadIncomingMessages = messages.some(
      (message) =>
        message.sender?._id &&
        String(message.sender._id) === String(senderId) &&
        message.status !== "read",
    );

    if (!hasUnreadIncomingMessages) {
      return;
    }

    socket.emit("mark_messages_read", {
      senderId,
    });
  }, [socket, selectedChat, messages, dmRelationship]);

  useEffect(() => {
    if (
      !selectedChat ||
      selectedChat.type !== "dm" ||
      dmRelationship !== "friend" ||
      messages.length === 0
    ) {
      return;
    }

    const otherUserId = selectedChat.user?._id;

    if (!otherUserId) {
      return;
    }

    const markConversationRead = async () => {
      try {
        await authFetch(
          `http://localhost:5000/api/messages/dm/${otherUserId}/read`,
          {
            method: "PATCH",
          },
        );
      } catch (error) {
        console.error("Failed to mark conversation as read:", error);
      }
    };

    markConversationRead();
  }, [selectedChat, messages, dmRelationship]);

  useEffect(() => {
    if (
      !socket ||
      !socket.connected ||
      !selectedChat ||
      selectedChat.type !== "cluster" ||
      !selectedChat.cluster?._id ||
      messages.length === 0
    ) {
      return;
    }

    const clusterId = String(selectedChat.cluster._id);
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage?._id) {
      return;
    }

    socket.emit("mark_cluster_read", {
      clusterId,
      messageId: latestMessage._id,
    });
  }, [socket, selectedChat, messages]);

  const handleReplyMessage = (message) => {
    if (!message?._id || isDmRelationshipDisabled) {
      return;
    }

    setEditingMessage(null);
    setReplyingTo(message);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleEditMessage = (message) => {
    if (!message?._id) {
      return;
    }

    setReplyingTo(null);

    setEditingMessage({
      _id: message._id,
      content: message.content || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleMessageEdited = (messageId, content) => {
    if (!messageId) {
      return;
    }

    shouldAutoScrollRef.current = false;

    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        String(message._id) === String(messageId)
          ? {
              ...message,
              content,
              isEdited: true,
            }
          : message,
      ),
    );

    setEditingMessage(null);
  };

  const handleUnsendMessage = async (messageId) => {
    if (!messageId) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/messages/${messageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unsend message");
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
    } catch (error) {
      console.error("Failed to unsend message:", error);
    }
  };

  const handleClearChat = () => {
    if (!isDM || !selectedChat?.user?._id) {
      return;
    }

    setIsDmMenuOpen(false);
    setIsClearChatConfirmOpen(true);
  };

  const handleConfirmClearChat = async () => {
    const otherUserId = selectedChat?.user?._id;

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

      setIsClearChatConfirmOpen(false);
      setMessages([]);
      setReplyingTo(null);
      setEditingMessage(null);
    } catch (error) {
      console.error("Failed to clear chat:", error);
    } finally {
      setIsClearChatLoading(false);
    }
  };

  const handleClusterInvitationResponse = (messageId, action) => {
    if (
      !messageId ||
      !action ||
      !socket ||
      !socket.connected ||
      respondingInvitationId
    ) {
      return;
    }

    setRespondingInvitationId(String(messageId));

    socket.emit("cluster_invitation_response", {
      messageId,
      action,
    });

    setTimeout(() => {
      setRespondingInvitationId((currentId) =>
        String(currentId) === String(messageId) ? null : currentId,
      );
    }, 1000);
  };

  const handleOpenChatProfile = () => {
    if (!isDM) {
      return;
    }

    const userId = selectedChat.user?._id;

    if (!userId) {
      console.error(
        "Cannot open profile: selected chat user has no _id.",
        selectedChat,
      );
      return;
    }

    setIsDmMenuOpen(false);
    onOpenProfile?.(userId);
  };

  const handleOpenClusterHeader = () => {
    if (!isCluster) {
      return;
    }

    setIsClusterMenuOpen(false);

    if (isClusterOwner) {
      setIsClusterSettingsOpen(true);
      return;
    }

    setIsClusterInfoOpen(true);
  };

  const handleOpenClusterMembers = () => {
    setIsClusterMenuOpen(false);
    setIsClusterMembersOpen(true);
  };

  const handleOpenClusterSettings = () => {
    setIsClusterMenuOpen(false);
    setIsClusterSettingsOpen(true);
  };

  const handleOpenClusterInfo = () => {
    setIsClusterMenuOpen(false);
    setIsClusterInfoOpen(true);
  };

  const handleTransferOwnership = () => {
    setIsClusterMenuOpen(false);
    setIsTransferOwnershipOpen(true);
  };

  const handleDeleteCluster = () => {
    setIsClusterMenuOpen(false);
    setIsDeleteClusterConfirmOpen(true);
  };

  const handleWipeChat = () => {
    if (!isCluster || !isClusterOwner) {
      return;
    }

    setIsClusterMenuOpen(false);
    setIsWipeChatConfirmOpen(true);
  };

  const handleConfirmWipeChat = async () => {
    const clusterId = selectedChat?.cluster?._id;

    if (!clusterId || isWipeChatLoading) {
      return;
    }

    setIsWipeChatLoading(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/messages/cluster/${clusterId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to wipe Cluster chat");
        return;
      }

      setIsWipeChatConfirmOpen(false);
      setMessages([]);
      setReplyingTo(null);
      setEditingMessage(null);
      setClusterTypingUsers(new Map());
    } catch (error) {
      console.error("Failed to wipe Cluster chat:", error);
    } finally {
      setIsWipeChatLoading(false);
    }
  };

  const handleTransferOwnershipCompleted = (updatedCluster) => {
    setIsTransferOwnershipOpen(false);

    if (updatedCluster?._id && onClusterUpdated) {
      onClusterUpdated(updatedCluster);
    }
  };

  const handleLeaveCluster = () => {
    setIsClusterMenuOpen(false);
    setIsClusterInfoOpen(false);
    setIsLeaveClusterConfirmOpen(true);
  };

  const handleConfirmLeaveCluster = async () => {
    const clusterId = selectedChat?.cluster?._id;

    if (!clusterId || isLeaveClusterLoading) {
      return;
    }

    setIsLeaveClusterLoading(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/clusters/${clusterId}/leave`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to leave Cluster");
        return;
      }

      setIsLeaveClusterConfirmOpen(false);
      setMessages([]);
      setReplyingTo(null);
      setEditingMessage(null);
      setClusterTypingUsers(new Map());

      onClusterLeft?.(String(clusterId));
    } catch (error) {
      console.error("Failed to leave Cluster:", error);
    } finally {
      setIsLeaveClusterLoading(false);
    }
  };

  const handleConfirmDeleteCluster = async () => {
    const clusterId = selectedChat?.cluster?._id;

    if (!clusterId || isDeleteClusterLoading) {
      return;
    }

    setIsDeleteClusterLoading(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/clusters/${clusterId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to delete Cluster");
        return;
      }

      setIsDeleteClusterConfirmOpen(false);
      handleClusterDeleted(data.clusterId || String(clusterId));
    } catch (error) {
      console.error("Failed to delete Cluster:", error);
    } finally {
      setIsDeleteClusterLoading(false);
    }
  };

  const handleClusterUpdated = (updatedCluster) => {
    if (!updatedCluster?._id) {
      return;
    }

    onClusterUpdated?.(updatedCluster);
  };

  const handleClusterDeleted = (clusterId) => {
    setIsClusterMembersOpen(false);
    setIsClusterSettingsOpen(false);
    setIsClusterInfoOpen(false);
    setIsClusterMenuOpen(false);
    setIsTransferOwnershipOpen(false);
    setIsLeaveClusterConfirmOpen(false);
    setIsDeleteClusterConfirmOpen(false);
    setIsDeleteClusterLoading(false);
    setClusterTypingUsers(new Map());
    setMessages([]);
    setReplyingTo(null);
    setEditingMessage(null);

    onClusterDeleted?.(clusterId);
  };

  if (!selectedChat) {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-chime-gold shadow-sm">
              <Bell size={32} className="text-chime-text" />
            </div>

            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-chime-text">
              Welcome to Chime
            </h1>

            <p className="mt-3 text-sm leading-6 text-chime-secondary sm:text-base">
              Your conversations start here. Find someone to message, catch up
              with your friends, or step into a Cluster and join the
              conversation.
            </p>

            <p className="mt-2 text-sm text-chime-secondary">
              Search for someone in the sidebar to get started.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const isDM = selectedChat.type === "dm";
  const isCluster = selectedChat.type === "cluster";

  const chatDisplayName = isDM
    ? selectedChat.user?.displayName || selectedChat.user?.username
    : selectedChat.cluster?.name || "Unnamed Cluster";

  const chatProfilePicture = isDM
    ? selectedChat.user?.profilePicture || ""
    : "";

  const clusterVisibility =
    selectedChat.cluster?.visibility ||
    selectedChat.cluster?.privacy ||
    (selectedChat.cluster?.isPublic ? "public" : "private");

  const clusterVisibilityLabel =
    String(clusterVisibility).toLowerCase() === "public"
      ? "Public Cluster"
      : "Private Cluster";

  const chatPresence =
    isDM && dmRelationship === "friend"
      ? getPresence(selectedChat.user?._id)
      : "offline";

  const presenceLabel =
    chatPresence === "online"
      ? "Online"
      : chatPresence === "away"
        ? "Away"
        : "Offline";

  const presenceDot =
    chatPresence === "online"
      ? "bg-green-500"
      : chatPresence === "away"
        ? "bg-amber-400"
        : "bg-stone-400";

  const canMessage = isCluster || dmRelationship === "friend";

  const isDmBlocked = isDM && dmRelationship === "blocked";
  const isDmBlockedByOther = isDM && dmRelationship === "blocked_by";

  const isDmRelationshipDisabled =
    isDM &&
    (dmRelationship === "unfriended" ||
      dmRelationship === "blocked" ||
      dmRelationship === "blocked_by");

  const isClusterOwner =
    isCluster &&
    String(
      selectedChat.cluster?.owner?._id || selectedChat.cluster?.owner || "",
    ) === String(user?._id);

  const clusterTypingList = Array.from(clusterTypingUsers.values());

  const clusterTypingNames = clusterTypingList
    .map(
      (typingUser) =>
        typingUser.displayName?.trim() || typingUser.username?.trim(),
    )
    .filter(Boolean);

  const clusterTypingLabel =
    clusterTypingNames.length === 1
      ? `${clusterTypingNames[0]} is typing`
      : clusterTypingNames.length === 2
        ? `${clusterTypingNames[0]}, ${clusterTypingNames[1]} are typing`
        : clusterTypingNames.length > 2
          ? `${clusterTypingNames[0]}, ${clusterTypingNames[1]} +${
              clusterTypingNames.length - 2
            } others are typing`
          : null;

  let latestReadMessageId = null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (
      message.sender?._id &&
      String(message.sender._id) === String(user?._id) &&
      message.status === "read"
    ) {
      latestReadMessageId = String(message._id);
      break;
    }
  }

  let latestClusterReadByMessageId = null;

  if (isCluster) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      const isOwnMessage =
        message.sender?._id && String(message.sender._id) === String(user?._id);

      const hasOtherReaders =
        isOwnMessage &&
        Array.isArray(message.readBy) &&
        message.readBy.some(
          (reader) => String(reader.userId) !== String(user?._id),
        );

      if (hasOtherReaders) {
        latestClusterReadByMessageId = String(message._id);
        break;
      }
    }
  }

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
      <header className="relative z-20 flex h-16 shrink-0 items-center border-b border-stone-200 bg-chime-background px-6">
        {isDM && (
          <button
            type="button"
            onClick={handleOpenChatProfile}
            className="mr-3 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold transition hover:opacity-80"
            aria-label={`Open ${chatDisplayName}'s profile`}
          >
            {chatProfilePicture ? (
              <img
                src={chatProfilePicture}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-chime-gold" />
            )}
          </button>
        )}

        {isCluster && (
          <button
            type="button"
            onClick={handleOpenClusterHeader}
            className="flex min-w-0 items-center text-left"
            aria-label={
              isClusterOwner ? "Open Cluster Settings" : "Open Cluster Info"
            }
          >
            <div className="mr-3 h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-chime-gold">
              {selectedChat.cluster?.profilePicture ? (
                <img
                  src={selectedChat.cluster.profilePicture}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-bold text-chime-text">
                  {chatDisplayName?.trim()?.charAt(0)?.toUpperCase() || "C"}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="truncate font-bold text-chime-text transition hover:text-chime-secondary">
                {chatDisplayName}
              </h2>

              <p className="text-xs text-chime-secondary">
                {clusterVisibilityLabel}
              </p>
            </div>
          </button>
        )}

        {isDM && (
          <div className="min-w-0">
            <button
              type="button"
              onClick={handleOpenChatProfile}
              className="min-w-0 text-left"
            >
              <h2 className="truncate font-bold text-chime-text">
                {chatDisplayName}
              </h2>

              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${presenceDot}`}
                />

                <span className="text-xs text-chime-secondary">
                  {presenceLabel}
                </span>
              </div>
            </button>
          </div>
        )}

        {isDM && (
          <div ref={dmMenuRef} className="relative ml-auto">
            <button
              type="button"
              onClick={() => setIsDmMenuOpen((current) => !current)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-chime-secondary transition ${
                isDmMenuOpen
                  ? "bg-stone-100 text-chime-text"
                  : "hover:bg-stone-100 hover:text-chime-text"
              }`}
              aria-label="Conversation actions"
              aria-expanded={isDmMenuOpen}
            >
              <MoreVertical size={20} strokeWidth={2} />
            </button>

            {isDmMenuOpen && (
              <DmContextMenu
                user={selectedChat.user}
                onViewProfile={handleOpenChatProfile}
                onUnfriend={handleUnfriend}
                onBlock={handleBlock}
                onUnblock={handleUnblock}
                onClearChat={handleClearChat}
                showUnfriend={dmRelationship === "friend"}
                showBlock={
                  dmRelationship !== "blocked_by" &&
                  dmRelationship !== "blocked"
                }
                showUnblock={dmRelationship === "blocked"}
                placement="chat"
                loading={isRelationshipLoading || isClearChatLoading}
              />
            )}
          </div>
        )}

        {isCluster && (
          <div ref={clusterMenuRef} className="relative ml-auto">
            <button
              type="button"
              onClick={() => setIsClusterMenuOpen((current) => !current)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-chime-secondary transition ${
                isClusterMenuOpen
                  ? "bg-stone-100 text-chime-text"
                  : "hover:bg-stone-100 hover:text-chime-text"
              }`}
              aria-label="Cluster actions"
              aria-expanded={isClusterMenuOpen}
            >
              <MoreVertical size={20} strokeWidth={2} />
            </button>

            {isClusterMenuOpen && (
              <ClusterContextMenu
                isOwner={isClusterOwner}
                memberCount={selectedChat.cluster?.memberCount || 0}
                isPrivate={
                  String(clusterVisibility).toLowerCase() === "private"
                }
                inviteCode={selectedChat.cluster?.inviteCode || ""}
                onMembers={handleOpenClusterMembers}
                onSettings={handleOpenClusterSettings}
                onTransferOwnership={handleTransferOwnership}
                onWipeChat={handleWipeChat}
                onDeleteCluster={handleDeleteCluster}
                onInfo={handleOpenClusterInfo}
                onLeaveCluster={handleLeaveCluster}
                loading={isWipeChatLoading || isDeleteClusterLoading}
              />
            )}
          </div>
        )}
      </header>

      <div
        ref={messagesContainerRef}
        className="chime-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto p-6 pb-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-chime-secondary">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-chime-gold">
                <MessageCircle size={26} className="text-chime-text" />
              </div>

              <h3 className="mt-4 font-bold text-chime-text">
                {isDM
                  ? `Start chatting with ${chatDisplayName}`
                  : `Welcome to ${chatDisplayName}`}
              </h3>

              <p className="mt-1 text-sm text-chime-secondary">
                {isDM
                  ? canMessage
                    ? "Send a message to start the conversation."
                    : isDmBlocked
                      ? `You blocked ${chatDisplayName}.`
                      : isDmBlockedByOther
                        ? `${chatDisplayName} has blocked you.`
                        : "You are no longer friends with this user."
                  : "This is the beginning of this Cluster."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const senderId = message.sender?._id || null;
              const isDeletedUser = !message.sender;

              const senderDisplayName = isDeletedUser
                ? "Deleted User"
                : message.sender.displayName || message.sender.username;

              const senderUsername = isDeletedUser
                ? "deleted"
                : message.sender.username || "user";

              const senderProfilePicture = isDeletedUser
                ? ""
                : message.sender.profilePicture || "";

              const isOwnMessage =
                !isDeletedUser && String(senderId) === String(user._id);

              const previousMessage = messages[index - 1];
              const previousSenderId = previousMessage?.sender?._id || null;
              const previousIsDeletedUser = !previousMessage?.sender;

              const isSameSender =
                previousMessage &&
                ((isDeletedUser && previousIsDeletedUser) ||
                  (!isDeletedUser &&
                    !previousIsDeletedUser &&
                    String(previousSenderId) === String(senderId)));

              const timeDifference = previousMessage
                ? new Date(message.createdAt) -
                  new Date(previousMessage.createdAt)
                : null;

              const isWithinOneMinute =
                timeDifference !== null &&
                timeDifference >= 0 &&
                timeDifference <= 60 * 1000;

              const isGrouped = isSameSender && isWithinOneMinute;

              const messageProfileHandler = isOwnMessage
                ? onOpenOwnProfile
                : onOpenProfile;

              const showReadStatus =
                isOwnMessage && String(message._id) === latestReadMessageId;

              const clusterReadBy =
                isCluster &&
                isOwnMessage &&
                String(message._id) === latestClusterReadByMessageId &&
                Array.isArray(message.readBy)
                  ? message.readBy.filter(
                      (reader) => String(reader.userId) !== String(user?._id),
                    )
                  : [];

              if (message.messageType === "cluster_invite") {
                return (
                  <div key={message._id} className="mb-4">
                    <ClusterInvitationMessage
                      message={message}
                      isOwnMessage={isOwnMessage}
                      onRespond={handleClusterInvitationResponse}
                      responding={
                        String(respondingInvitationId) === String(message._id)
                      }
                    />
                  </div>
                );
              }

              return (
                <Message
                  key={message._id}
                  userId={senderId}
                  displayName={senderDisplayName}
                  username={senderUsername}
                  profilePicture={senderProfilePicture}
                  time={new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  content={message.content}
                  status={message.status}
                  showReadStatus={showReadStatus}
                  avatarColor="bg-chime-bright"
                  isOwnMessage={isOwnMessage}
                  isGrouped={isGrouped}
                  isClusterMessage={isCluster}
                  readBy={clusterReadBy}
                  onOpenProfile={messageProfileHandler}
                  messageId={message._id}
                  onUnsend={isOwnMessage ? handleUnsendMessage : undefined}
                  onEdit={isOwnMessage ? handleEditMessage : undefined}
                  onReply={
                    isDmRelationshipDisabled ? undefined : handleReplyMessage
                  }
                  replyTo={message.replyTo}
                  onJumpToMessage={handleJumpToMessage}
                  isEdited={message.isEdited}
                />
              );
            })}

            <div ref={messagesEndRef} className="h-1" />
          </>
        )}
      </div>

      {((isDM && isOtherUserTyping) || (isCluster && clusterTypingLabel)) &&
        canMessage && (
          <div className="shrink-0 px-6 pb-1">
            <div className="flex h-7 items-center gap-2 text-xs text-chime-secondary">
              <span>
                {isDM ? `${chatDisplayName} is typing` : clusterTypingLabel}
              </span>

              <span className="flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-chime-secondary [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-chime-secondary [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-chime-secondary" />
              </span>
            </div>
          </div>
        )}

      <div className="relative z-30 shrink-0">
        {isDM && !canMessage ? (
          <div className="border-t border-stone-200 bg-chime-background px-6 py-4 text-center">
            <p className="text-sm font-medium text-chime-secondary">
              {isDmBlocked
                ? `You blocked ${chatDisplayName}.`
                : isDmBlockedByOther
                  ? `${chatDisplayName} has blocked you.`
                  : `You are no longer friends with ${chatDisplayName}.`}
            </p>

            <p className="mt-1 text-xs text-chime-secondary">
              {isDmBlocked
                ? "Your conversation history is still available. Unblock this user from the menu if you want to reconnect."
                : isDmBlockedByOther
                  ? "Your conversation history is still available, but you cannot send new messages."
                  : "Your conversation history is still available, but you cannot send new messages unless you become friends again."}
            </p>
          </div>
        ) : (
          <MessageInput
            socket={socket}
            selectedChat={selectedChat}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            editingMessage={editingMessage}
            onCancelEdit={handleCancelEdit}
            onMessageEdited={handleMessageEdited}
          />
        )}
      </div>

      {isCluster && (
        <>
          <ClusterMembersPanel
            isOpen={isClusterMembersOpen}
            cluster={selectedChat.cluster}
            socket={socket}
            onClose={() => setIsClusterMembersOpen(false)}
            onOpenProfile={onOpenProfile}
            onSelectChat={onSelectChat}
          />

          <ClusterSettingsPanel
            isOpen={isClusterSettingsOpen}
            cluster={selectedChat.cluster}
            onClose={() => setIsClusterSettingsOpen(false)}
            onClusterUpdated={handleClusterUpdated}
            onClusterDeleted={handleClusterDeleted}
          />

          <ClusterInfoPanel
            isOpen={isClusterInfoOpen}
            cluster={selectedChat.cluster}
            onClose={() => setIsClusterInfoOpen(false)}
            onOpenMembers={() => {
              setIsClusterInfoOpen(false);
              setIsClusterMembersOpen(true);
            }}
            onLeaveCluster={handleLeaveCluster}
          />

          <TransferOwnershipPanel
            isOpen={isTransferOwnershipOpen}
            cluster={selectedChat.cluster}
            onClose={() => setIsTransferOwnershipOpen(false)}
            onTransferred={handleTransferOwnershipCompleted}
          />
        </>
      )}

      <ConfirmModal
        isOpen={relationshipAction !== null}
        title={
          relationshipAction === "block" ? "Block user?" : "Unfriend user?"
        }
        message={
          relationshipAction === "block"
            ? `Are you sure you want to block ${chatDisplayName}? They will also be removed from your friends list and you will no longer be able to message each other.`
            : `Are you sure you want to unfriend ${chatDisplayName}? You will no longer be able to send messages to each other unless you become friends again.`
        }
        confirmText={relationshipAction === "block" ? "Block" : "Unfriend"}
        cancelText="Cancel"
        onConfirm={handleConfirmRelationshipAction}
        onCancel={() => {
          if (!isRelationshipLoading) {
            setRelationshipAction(null);
          }
        }}
        loading={isRelationshipLoading}
      />

      <ConfirmModal
        isOpen={isClearChatConfirmOpen}
        title="Clear Chat?"
        message={`Are you sure you want to clear your chat with ${chatDisplayName}? This will only remove the conversation from your view. ${chatDisplayName} will still have their chat history.`}
        confirmText="Clear Chat"
        cancelText="Cancel"
        onConfirm={handleConfirmClearChat}
        onCancel={() => {
          if (!isClearChatLoading) {
            setIsClearChatConfirmOpen(false);
          }
        }}
        loading={isClearChatLoading}
      />

      <ConfirmModal
        isOpen={isLeaveClusterConfirmOpen}
        title="Leave Cluster?"
        message={`Are you sure you want to leave ${
          selectedChat?.cluster?.name || "this Cluster"
        }? You will need to join again if you want to return.`}
        confirmText="Leave Cluster"
        cancelText="Cancel"
        onConfirm={handleConfirmLeaveCluster}
        onCancel={() => {
          if (!isLeaveClusterLoading) {
            setIsLeaveClusterConfirmOpen(false);
          }
        }}
        loading={isLeaveClusterLoading}
      />

      <ConfirmModal
        isOpen={isDeleteClusterConfirmOpen}
        title="Delete Cluster?"
        message={`Are you sure you want to permanently delete ${
          selectedChat?.cluster?.name || "this Cluster"
        } and all of its messages? This action cannot be undone.`}
        confirmText={isDeleteClusterLoading ? "Deleting..." : "Delete Cluster"}
        cancelText="Cancel"
        onConfirm={handleConfirmDeleteCluster}
        onCancel={() => {
          if (!isDeleteClusterLoading) {
            setIsDeleteClusterConfirmOpen(false);
          }
        }}
        loading={isDeleteClusterLoading}
      />

      <ConfirmModal
        isOpen={isWipeChatConfirmOpen}
        title="Wipe Chat?"
        message="This will permanently delete all messages in this Cluster for everyone. This action cannot be undone."
        confirmText={isWipeChatLoading ? "Wiping..." : "Wipe Chat"}
        cancelText="Cancel"
        onConfirm={handleConfirmWipeChat}
        onCancel={() => {
          if (!isWipeChatLoading) {
            setIsWipeChatConfirmOpen(false);
          }
        }}
        loading={isWipeChatLoading}
      />
    </main>
  );
}

export default ChatArea;
