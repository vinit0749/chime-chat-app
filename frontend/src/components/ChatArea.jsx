import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Message from "./Message";
import MessageInput from "./MessageInput";
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

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const selectedChatRef = useRef(selectedChat);

  /*
    Controls whether a messages update should scroll
    to the latest message.

    true  = new message / initial history load
    false = edit / unsend / read / delivery / chat switch
  */
  const shouldAutoScrollRef = useRef(false);

  /*
    ============================================================
    KEEP CURRENT CHAT AVAILABLE TO SOCKET
    ============================================================
  */
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  /*
    ============================================================
    CHANGE CONVERSATION
    ============================================================
  */
  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);

    shouldAutoScrollRef.current = false;

    setMessages([]);
  }, [selectedChat]);

  /*
    ============================================================
    SOCKET CONNECTION
    ============================================================
  */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !user?.id) {
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

    /*
      ==========================================================
      NEW MESSAGE
      ==========================================================
    */
    newSocket.on("new_message", (newMessage) => {
      if (!newMessage?._id) {
        return;
      }

      const currentChat = selectedChatRef.current;

      if (!currentChat) {
        return;
      }

      setMessages((currentMessages) => {
        /*
          Never add the same message twice.
        */
        if (
          currentMessages.some(
            (message) => String(message._id) === String(newMessage._id),
          )
        ) {
          return currentMessages;
        }

        /*
          ========================================================
          PUBLIC ROOM
          ========================================================
        */
        if (currentChat.type === "room") {
          const currentRoom = currentChat.room || "general";
          const messageRoom = newMessage.room || "general";

          const isCorrectRoom =
            !newMessage.recipient &&
            String(messageRoom) === String(currentRoom);

          if (!isCorrectRoom) {
            return currentMessages;
          }

          let sender = newMessage.sender;

          if (sender) {
            sender = {
              ...sender,
              profilePicture:
                sender.profilePicture ||
                (String(sender._id) === String(user.id)
                  ? user.profilePicture || ""
                  : ""),
              displayName:
                sender.displayName ||
                (String(sender._id) === String(user.id)
                  ? user.displayName || ""
                  : ""),
              username:
                sender.username ||
                (String(sender._id) === String(user.id)
                  ? user.username || ""
                  : ""),
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

        /*
          ========================================================
          DIRECT MESSAGE
          ========================================================
        */
        if (currentChat.type === "dm") {
          const currentUserId = String(user.id);
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

    /*
      ==========================================================
      MESSAGE DELIVERED
      ==========================================================
    */
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

    /*
      ==========================================================
      MESSAGES READ
      ==========================================================
    */
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

    /*
      ==========================================================
      MESSAGE EDITED
      ==========================================================
    */
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

    /*
      ==========================================================
      MESSAGE UNSENT
      ==========================================================
    */
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

      /*
        If the message being unsent is currently being replied to,
        clear the reply composer.
      */
      setReplyingTo((currentReply) =>
        currentReply && String(currentReply._id) === String(messageId)
          ? null
          : currentReply,
      );

      /*
        If the message being unsent is currently being edited,
        cancel editing.
      */
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
  }, [user?.id]);

  /*
    ============================================================
    FETCH CURRENT CONVERSATION HISTORY
    ============================================================
  */
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
          url = `http://localhost:5000/api/messages/dm/${selectedChat.user._id}`;
        } else if (selectedChat.type === "room") {
          url = "http://localhost:5000/api/messages";
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

        /*
          ========================================================
          FILTER HISTORY ON THE CLIENT
          ========================================================
        */
        let filteredMessages = [];

        if (selectedChat.type === "room") {
          const currentRoom = selectedChat.room || "general";

          filteredMessages = fetchedMessages.filter((message) => {
            const messageRoom = message.room || "general";

            return (
              !message.recipient && String(messageRoom) === String(currentRoom)
            );
          });
        }

        if (selectedChat.type === "dm") {
          const currentUserId = String(user.id);
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

        /*
          Make sure this request still belongs to the
          currently selected conversation.
        */
        const latestChat = selectedChatRef.current;

        if (!latestChat) {
          return;
        }

        const sameChat =
          latestChat.type === selectedChat.type &&
          (selectedChat.type === "room"
            ? String(latestChat.room || "general") ===
              String(selectedChat.room || "general")
            : String(latestChat.user?._id) === String(selectedChat.user?._id));

        if (!sameChat) {
          return;
        }

        /*
          ========================================================
          NORMALIZE SENDER DATA
          ========================================================
        */
        const normalizedMessages = filteredMessages.map((message) => {
          if (!message.sender) {
            return message;
          }

          const senderId = String(message.sender._id);

          if (senderId === String(user.id)) {
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

        /*
          History loading should scroll to the bottom.
        */
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

  /*
    ============================================================
    MARK INCOMING DM MESSAGES AS READ
    ============================================================
  */
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

  /*
    ============================================================
    AUTO SCROLL
    ============================================================
  */
  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    shouldAutoScrollRef.current = false;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /*
    ============================================================
    JUMP TO REPLIED MESSAGE
    ============================================================
  */
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

  /*
    ============================================================
    REPLY
    ============================================================
  */
  const handleReplyMessage = (message) => {
    if (!message?._id) {
      return;
    }

    /*
      Editing and replying are mutually exclusive.
    */
    setEditingMessage(null);
    setReplyingTo(message);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  /*
    ============================================================
    EDIT
    ============================================================
    
    Message.jsx passes the COMPLETE message object:
    
      {
        _id,
        content
      }
    
    We do NOT send the PATCH request here.
    
    MessageInput owns the actual edit submission because it already
    has the editing UI and submit logic.
    */
  const handleEditMessage = (message) => {
    if (!message?._id) {
      return;
    }

    /*
      Editing and replying are mutually exclusive.
    */
    setReplyingTo(null);

    setEditingMessage({
      _id: message._id,
      content: message.content || "",
    });
  };

  /*
    ============================================================
    CANCEL EDIT
    ============================================================
  */
  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  /*
    ============================================================
    MESSAGE EDITED
    ============================================================
    
    Called by MessageInput after the PATCH request succeeds.
    */
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

  /*
    ============================================================
    UNSEND
    ============================================================
  */
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

      /*
        Preserve the current scroll position.
      */
      shouldAutoScrollRef.current = false;

      setMessages((currentMessages) =>
        currentMessages.filter(
          (message) => String(message._id) !== String(messageId),
        ),
      );

      /*
        If the deleted message was being replied to,
        cancel that reply.
      */
      setReplyingTo((currentReply) =>
        currentReply && String(currentReply._id) === String(messageId)
          ? null
          : currentReply,
      );

      /*
        If the deleted message was being edited,
        cancel editing.
      */
      setEditingMessage((currentEdit) =>
        currentEdit && String(currentEdit._id) === String(messageId)
          ? null
          : currentEdit,
      );
    } catch (error) {
      console.error("Failed to unsend message:", error);
    }
  };

  /*
    ============================================================
    WELCOME SCREEN
    ============================================================
  */
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
              sidebar and start a conversation.
            </p>

            <p className="mt-2 text-sm text-chime-secondary">
              Your conversations will appear here.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
    ============================================================
    CHAT INFORMATION
    ============================================================
  */
  const chatDisplayName =
    selectedChat.type === "dm"
      ? selectedChat.user.displayName || selectedChat.user.username
      : "General";

  const chatProfilePicture =
    selectedChat.type === "dm" ? selectedChat.user.profilePicture || "" : "";

  const chatSubtitle =
    selectedChat.type === "dm" ? "Direct message" : "Public room";

  const chatPresence =
    selectedChat.type === "dm" ? getPresence(selectedChat.user._id) : null;

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

  const canMessage =
    selectedChat.type === "room" || selectedChat.isFriend !== false;

  /*
    Find the latest message from the current user
    that has been read.
  */
  let latestReadMessageId = null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (
      message.sender?._id &&
      String(message.sender._id) === String(user.id) &&
      message.status === "read"
    ) {
      latestReadMessageId = String(message._id);
      break;
    }
  }

  /*
    ============================================================
    OPEN CHAT PROFILE
    ============================================================
  */
  const handleOpenChatProfile = () => {
    if (selectedChat.type !== "dm") {
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

  /*
    ============================================================
    RENDER
    ============================================================
  */
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
      {/* Chat Header */}
      <header className="relative z-20 flex h-16 shrink-0 items-center border-b border-stone-200 bg-chime-background px-6">
        {selectedChat.type === "dm" && (
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

        {selectedChat.type === "room" && (
          <span className="mr-3 text-xl text-chime-secondary">#</span>
        )}

        <div className="min-w-0">
          {selectedChat.type === "dm" ? (
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
            <>
              <h2 className="truncate font-bold text-chime-text">
                {chatDisplayName}
              </h2>

              <p className="text-sm text-chime-secondary">{chatSubtitle}</p>
            </>
          )}
        </div>
      </header>

      {/* Messages */}
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
                {selectedChat.type === "dm" ? "💬" : "#"}
              </div>

              <h3 className="mt-4 font-bold text-chime-text">
                {selectedChat.type === "dm"
                  ? `Start chatting with ${chatDisplayName}`
                  : "Welcome to General"}
              </h3>

              <p className="mt-1 text-sm text-chime-secondary">
                {selectedChat.type === "dm"
                  ? canMessage
                    ? "Send a message to start the conversation."
                    : "You are no longer friends with this user."
                  : "This is the beginning of this room."}
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
                !isDeletedUser && String(senderId) === String(user.id);

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

      {/* Message Input */}
      <div className="relative z-30 shrink-0">
        {selectedChat.type === "dm" && !canMessage ? (
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
          />
        )}
      </div>
    </main>
  );
}

export default ChatArea;
