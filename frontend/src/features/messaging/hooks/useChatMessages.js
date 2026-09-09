import { useEffect, useRef, useState } from "react";
import { authFetch } from "../../../shared/utils/authFetch";

function useChatMessages({ selectedChat, user }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResultIndex, setSearchResultIndex] = useState(-1);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(false);
  const selectedChatRef = useRef(selectedChat);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      setSearchQuery("");
      setSearchResults([]);
      setSearchResultIndex(-1);
      return;
    }

    setSearchQuery("");
    setSearchResults([]);
    setSearchResultIndex(-1);

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

          url = `${import.meta.env.VITE_BACKEND_URL}/api/messages/dm/${selectedChat.user._id}`;
        } else if (selectedChat.type === "cluster") {
          if (!selectedChat.cluster?._id) {
            setMessages([]);
            return;
          }

          url = `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${selectedChat.cluster._id}/messages`;
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

  const handleSearch = async () => {
    const query = searchQuery.trim();

    if (!query || !selectedChat || isSearching) {
      return;
    }

    searchRequestRef.current += 1;
    const requestId = searchRequestRef.current;

    setIsSearching(true);
    setSearchResults([]);
    setSearchResultIndex(-1);

    try {
      const params = new URLSearchParams({
        query,
      });

      if (selectedChat.type === "dm") {
        if (!selectedChat.user?._id) {
          return;
        }

        params.set("userId", selectedChat.user._id);
      } else if (selectedChat.type === "cluster") {
        if (!selectedChat.cluster?._id) {
          return;
        }

        params.set("clusterId", selectedChat.cluster._id);
      } else {
        return;
      }

      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/messages/search?${params.toString()}`,
      );

      const data = await response.json();

      if (requestId !== searchRequestRef.current) {
        return;
      }

      if (!response.ok) {
        console.error(data.message || "Failed to search messages");
        setSearchResults([]);
        setSearchResultIndex(-1);
        return;
      }

      const results = Array.isArray(data.messages)
        ? [...data.messages].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
        : [];

      setSearchResults(results);
      setSearchResultIndex(results.length > 0 ? 0 : -1);
    } catch (error) {
      if (requestId === searchRequestRef.current) {
        console.error("Failed to search messages:", error);
        setSearchResults([]);
        setSearchResultIndex(-1);
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSearchNext = () => {
    if (searchResults.length === 0) {
      return;
    }

    setSearchResultIndex((currentIndex) => {
      if (currentIndex < 0) {
        return 0;
      }

      return (currentIndex + 1) % searchResults.length;
    });
  };

  const handleSearchPrevious = () => {
    if (searchResults.length === 0) {
      return;
    }

    setSearchResultIndex((currentIndex) => {
      if (currentIndex < 0) {
        return searchResults.length - 1;
      }

      return (currentIndex - 1 + searchResults.length) % searchResults.length;
    });
  };

  const handleClearSearch = () => {
    searchRequestRef.current += 1;
    setSearchQuery("");
    setSearchResults([]);
    setSearchResultIndex(-1);
    setIsSearching(false);
  };

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

  useEffect(() => {
    if (searchResultIndex < 0 || searchResultIndex >= searchResults.length) {
      return;
    }

    const messageId = searchResults[searchResultIndex]?._id;

    if (!messageId) {
      return;
    }

    handleJumpToMessage(messageId);
  }, [searchResultIndex, searchResults]);

  return {
    messages,
    setMessages,
    isLoading,
    messagesEndRef,
    messagesContainerRef,
    selectedChatRef,
    shouldAutoScrollRef,
    handleJumpToMessage,

    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchResultIndex,
    handleSearch,
    handleSearchNext,
    handleSearchPrevious,
    handleClearSearch,
  };
}

export default useChatMessages;
