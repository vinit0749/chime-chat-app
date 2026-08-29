import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Message from "./Message";
import MessageInput from "./MessageInput";
import ClusterMembersPanel from "./ClusterMembersPanel";
import { authFetch } from "../utils/authFetch";
import { usePresence } from "../context/PresenceContext";

function ChatArea({ selectedChat, onOpenProfile, onOpenOwnProfile }) {
  const user = JSON.parse(localStorage.getItem("user"));

  const { getPresence } = usePresence();

  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isClusterMembersOpen, setIsClusterMembersOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const selectedChatRef = useRef(selectedChat);
  const shouldAutoScrollRef = useRef(false);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    setIsOtherUserTyping(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setIsClusterMembersOpen(false);
    shouldAutoScrollRef.current = false;
    setMessages([]);
  }, [selectedChat]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !user?._id) {
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
          const currentUserId = String(user._id);
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
                sender.profilePicture || user.profilePicture || "",
              displayName: sender.displayName || user.displayName || "",
              username: sender.username || user.username || "",
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
                (senderId === String(user._id)
                  ? user.profilePicture || ""
                  : ""),
              displayName:
                message.sender.displayName ||
                (senderId === String(user._id) ? user.displayName || "" : ""),
              username:
                message.sender.username ||
                (senderId === String(user._id) ? user.username || "" : ""),
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
    };
  }, [user?._id]);

  useEffect(() => {
    if (!socket || !selectedChat) {
      return;
    }

    if (selectedChat.type !== "cluster" || !selectedChat.cluster?._id) {
      return;
    }

    const clusterId = String(selectedChat.cluster._id);

    const joinCluster = () => {
      console.log("[CLUSTER ROOM] Joining:", clusterId);

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
        console.log("[CLUSTER ROOM] Leaving:", clusterId);

        socket.emit("leave_cluster", {
          clusterId,
        });
      }
    };
  }, [socket, selectedChat]);

  const stopTyping = () => {
    const currentChat = selectedChatRef.current;

    if (
      !socket ||
      !socket.connected ||
      !currentChat ||
      currentChat.type !== "dm" ||
      !currentChat.user?._id
    ) {
      return;
    }

    socket.emit("typing_stop", {
      recipient: currentChat.user._id,
    });
  };

  useEffect(() => {
    if (!selectedChat) {
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      setIsLoading(true);

      try {
        let url;

        if (selectedChat.type === "dm") {
          if (!selectedChat.user?._id) {
            setMessages([]);
            return;
          }

          url = `http://localhost:5000/api/messages/dm/${selectedChat.user._id}`;
        } else if (selectedChat.type === "cluster") {
          if (!selectedChat.cluster?._id) {
            setMessages([]);
            return;
          }

          url = `http://localhost:5000/api/clusters/${selectedChat.cluster._id}/messages`;
        } else {
          setMessages([]);
          return;
        }

        const response = await authFetch(url);
        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          console.error(data.message || "Failed to fetch messages");
          setMessages([]);
          return;
        }

        const fetchedMessages = Array.isArray(data.messages)
          ? data.messages
          : [];

        let filteredMessages = [];

        if (selectedChat.type === "cluster") {
          const currentClusterId = String(selectedChat.cluster._id);

          filteredMessages = fetchedMessages.filter((message) => {
            const messageClusterId = String(
              message.clusterId ||
                message.cluster?._id ||
                message.cluster ||
                "",
            );

            return messageClusterId === currentClusterId;
          });
        }

        if (selectedChat.type === "dm") {
          const currentUserId = String(user._id);
          const otherUserId = String(selectedChat.user?._id);

          filteredMessages = fetchedMessages.filter((message) => {
            if (!message.sender || !message.recipient) {
              return false;
            }

            const senderId = String(message.sender._id);

            const recipientId = String(
              message.recipient._id || message.recipient,
            );

            return (
              (senderId === currentUserId && recipientId === otherUserId) ||
              (senderId === otherUserId && recipientId === currentUserId)
            );
          });
        }

        const latestChat = selectedChatRef.current;

        if (!latestChat) {
          return;
        }

        const sameChat =
          latestChat.type === selectedChat.type &&
          (selectedChat.type === "cluster"
            ? String(latestChat.cluster?._id) ===
              String(selectedChat.cluster?._id)
            : String(latestChat.user?._id) === String(selectedChat.user?._id));

        if (!sameChat) {
          return;
        }

        const normalizedMessages = filteredMessages.map((message) => {
          if (!message.sender) {
            return message;
          }

          const senderId = String(message.sender._id);

          if (senderId === String(user._id)) {
            return {
              ...message,
              sender: {
                ...message.sender,
                profilePicture:
                  message.sender.profilePicture || user.profilePicture || "",
                displayName:
                  message.sender.displayName || user.displayName || "",
                username: message.sender.username || user.username || "",
              },
            };
          }

          if (
            selectedChat.type === "dm" &&
            senderId === String(selectedChat.user?._id)
          ) {
            return {
              ...message,
              sender: {
                ...message.sender,
                profilePicture:
                  message.sender.profilePicture ||
                  selectedChat.user.profilePicture ||
                  "",
                displayName:
                  message.sender.displayName ||
                  selectedChat.user.displayName ||
                  "",
                username:
                  message.sender.username || selectedChat.user.username || "",
              },
            };
          }

          return message;
        });

        shouldAutoScrollRef.current = true;

        setMessages(
          normalizedMessages.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          ),
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch messages:", error);
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedChat]);

  useEffect(() => {
    if (
      !socket ||
      !socket.connected ||
      !selectedChat ||
      selectedChat.type !== "dm" ||
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
  }, [socket, selectedChat, messages]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    shouldAutoScrollRef.current = false;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const handleJumpToMessage = (messageId) => {
    if (!messageId) {
      return;
    }

    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`,
    );

    if (!messageElement) {
      console.warn("Could not find replied message:", messageId);
      return;
    }

    messageElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    messageElement.classList.add(
      "bg-yellow-100/70",
      "rounded-xl",
      "transition-colors",
      "duration-300",
    );

    setTimeout(() => {
      messageElement.classList.remove("bg-yellow-100/70");
    }, 1200);
  };

  const handleReplyMessage = (message) => {
    if (!message?._id) {
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
      const response = await authFetch(
        `http://localhost:5000/api/messages/${messageId}`,
        {
          method: "DELETE",
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

  if (!selectedChat) {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-chime-gold text-4xl shadow-sm">
              🔔
            </div>

            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-chime-text">
              Welcome to Chime
            </h1>

            <p className="mt-3 text-sm leading-6 text-chime-secondary sm:text-base">
              A friendly place to connect and chat. Search for someone in the
              sidebar or join a Cluster to start a conversation.
            </p>

            <p className="mt-2 text-sm text-chime-secondary">
              Your conversations and Clusters will appear here.
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

  const chatPresence = isDM ? getPresence(selectedChat.user?._id) : null;

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

  const canMessage = isCluster || selectedChat.isFriend !== false;

  let latestReadMessageId = null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (
      message.sender?._id &&
      String(message.sender._id) === String(user._id) &&
      message.status === "read"
    ) {
      latestReadMessageId = String(message._id);
      break;
    }
  }

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

    if (onOpenProfile) {
      onOpenProfile(userId);
    }
  };

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
          <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chime-gold text-lg font-bold text-chime-text">
            {chatDisplayName?.trim()?.charAt(0)?.toUpperCase() || "C"}
          </div>
        )}

        <div className="min-w-0">
          {isDM ? (
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
          ) : (
            <div className="min-w-0">
              <h2 className="truncate font-bold text-chime-text">
                {chatDisplayName}
              </h2>

              <p className="text-xs text-chime-secondary">
                {clusterVisibilityLabel}
              </p>
            </div>
          )}
        </div>

        {isCluster && (
          <button
            type="button"
            onClick={() => setIsClusterMembersOpen(true)}
            className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-chime-secondary transition hover:bg-stone-100 hover:text-chime-text"
            aria-label="View Cluster members"
          >
            <span className="text-base">👥</span>
            <span>Members</span>
          </button>
        )}
      </header>

      <div
        ref={messagesContainerRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto p-6 pb-1"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-chime-secondary">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-chime-gold text-2xl">
                {isDM ? "💬" : "C"}
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
                  onOpenProfile={messageProfileHandler}
                  messageId={message._id}
                  onUnsend={isOwnMessage ? handleUnsendMessage : undefined}
                  onEdit={isOwnMessage ? handleEditMessage : undefined}
                  onReply={handleReplyMessage}
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

      {isDM && isOtherUserTyping && (
        <div className="shrink-0 px-6 pb-1">
          <div className="flex h-7 items-center gap-2 text-xs text-chime-secondary">
            <span>{chatDisplayName} is typing</span>

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
              You are no longer friends with {chatDisplayName}.
            </p>

            <p className="mt-1 text-xs text-chime-secondary">
              Your conversation history is still available, but you cannot send
              new messages unless you become friends again.
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
            onTyping={() => {}}
            onStopTyping={stopTyping}
          />
        )}
      </div>

      {isCluster && (
        <ClusterMembersPanel
          isOpen={isClusterMembersOpen}
          cluster={selectedChat.cluster}
          onClose={() => setIsClusterMembersOpen(false)}
          onOpenProfile={onOpenProfile}
        />
      )}
    </main>
  );
}

export default ChatArea;
