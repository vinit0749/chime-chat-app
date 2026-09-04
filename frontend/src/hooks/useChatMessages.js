import { useEffect, useRef, useState } from "react";
import { authFetch } from "../utils/authFetch";

function useChatMessages({ selectedChat, user }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(false);
  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
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
          const clusterId = String(selectedChat.cluster._id);

          filteredMessages = fetchedMessages.filter((message) => {
            const messageClusterId = String(
              message.clusterId ||
                message.cluster?._id ||
                message.cluster ||
                "",
            );

            return messageClusterId === clusterId;
          });
        }

        if (selectedChat.type === "dm") {
          const currentUserId = String(user._id);
          const otherUserId = String(selectedChat.user._id);

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
  }, [selectedChat, user?._id]);

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

  return {
    messages,
    setMessages,
    isLoading,
    messagesEndRef,
    messagesContainerRef,
    selectedChatRef,
    shouldAutoScrollRef,
    handleJumpToMessage,
  };
}

export default useChatMessages;
