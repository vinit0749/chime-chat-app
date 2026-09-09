import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { authFetch } from "../../../shared/utils/authFetch";

function MessageInput({
  socket,
  selectedChat,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onMessageEdited,
  onTyping,
  onStopTyping,
}) {
  const [content, setContent] = useState("");
  const inputRef = useRef(null);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const stopTyping = () => {
    if (!isTypingRef.current) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (socket?.connected && selectedChat) {
      if (selectedChat.type === "dm") {
        const recipientId = selectedChat.user?._id;

        if (recipientId) {
          socket.emit("typing_stop", {
            recipient: recipientId,
          });
        }
      }

      if (selectedChat.type === "cluster") {
        const clusterId = selectedChat.cluster?._id;

        if (clusterId) {
          socket.emit("cluster_typing_stop", {
            clusterId,
          });
        }
      }
    }

    isTypingRef.current = false;
    onStopTyping?.();
  };

  const handleTyping = (event) => {
    const value = event.target.value;

    setContent(value);

    if (!socket || !socket.connected || !selectedChat || editingMessage) {
      return;
    }

    let typingTarget = null;

    if (selectedChat.type === "dm") {
      typingTarget = selectedChat.user?._id;
    } else if (selectedChat.type === "cluster") {
      typingTarget = selectedChat.cluster?._id;
    }

    if (!typingTarget) {
      return;
    }

    if (!isTypingRef.current && value.trim()) {
      if (selectedChat.type === "dm") {
        socket.emit("typing_start", {
          recipient: typingTarget,
        });
      } else if (selectedChat.type === "cluster") {
        socket.emit("cluster_typing_start", {
          clusterId: typingTarget,
        });
      }

      isTypingRef.current = true;
      onTyping?.();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 1000);
    } else {
      stopTyping();
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (isTypingRef.current && socket?.connected && selectedChat) {
        if (selectedChat.type === "dm") {
          const recipientId = selectedChat.user?._id;

          if (recipientId) {
            socket.emit("typing_stop", {
              recipient: recipientId,
            });
          }
        }

        if (selectedChat.type === "cluster") {
          const clusterId = selectedChat.cluster?._id;

          if (clusterId) {
            socket.emit("cluster_typing_stop", {
              clusterId,
            });
          }
        }
      }

      isTypingRef.current = false;
    };
  }, [socket, selectedChat]);

  useEffect(() => {
    if (!editingMessage) {
      return;
    }

    stopTyping();

    setContent(editingMessage.content || "");

    requestAnimationFrame(() => {
      inputRef.current?.focus();

      const length = inputRef.current?.value.length || 0;

      inputRef.current?.setSelectionRange(length, length);
    });
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo && !editingMessage) {
      inputRef.current?.focus();
    }
  }, [replyingTo, editingMessage]);

  const handleCancelEdit = () => {
    stopTyping();
    setContent("");
    onCancelEdit?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    if (editingMessage) {
      const originalContent = editingMessage.content?.trim() || "";

      if (trimmedContent === originalContent) {
        setContent("");
        onCancelEdit?.();
        return;
      }

      try {
        const response = await authFetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/messages/${editingMessage._id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: trimmedContent,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message || "Failed to edit message");
          return;
        }

        onMessageEdited?.(editingMessage._id, trimmedContent);

        setContent("");
        onCancelEdit?.();
      } catch (error) {
        console.error("Failed to edit message:", error);
      }

      return;
    }

    if (!socket?.connected) {
      console.error("Socket is not connected");
      return;
    }

    if (!selectedChat) {
      return;
    }

    stopTyping();

    if (selectedChat.type === "dm") {
      const recipientId = selectedChat.user?._id;

      if (!recipientId) {
        console.error("Cannot send message: recipient is missing");
        return;
      }

      const messageData = {
        recipient: recipientId,
        content: trimmedContent,
      };

      if (replyingTo?._id) {
        messageData.replyTo = replyingTo._id;
      }

      socket.emit("send_message", messageData);
    } else if (selectedChat.type === "cluster") {
      const clusterId = selectedChat.cluster?._id;

      if (!clusterId) {
        console.error("Cannot send message: cluster is missing");
        return;
      }

      const messageData = {
        clusterId,
        content: trimmedContent,
      };

      if (replyingTo?._id) {
        messageData.replyTo = replyingTo._id;
      }

      socket.emit("send_cluster_message", messageData);
    } else {
      console.error("Unknown chat type:", selectedChat.type);
      return;
    }

    setContent("");

    if (replyingTo) {
      onCancelReply?.();
    }
  };

  const replyProfileName =
    replyingTo?.sender?.displayName?.trim() ||
    replyingTo?.sender?.username ||
    "Deleted User";

  const isEditing = Boolean(editingMessage);

  return (
    <div className="border-t border-stone-200 bg-chime-background p-4">
      {isEditing && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-stone-200 bg-chime-chat px-3 py-2.5">
          <div className="min-w-0 flex-1 border-l-2 border-chime-gold pl-3">
            <p className="text-xs font-bold text-chime-text">Editing message</p>

            <p className="mt-0.5 truncate text-xs text-chime-secondary">
              {editingMessage.content}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCancelEdit}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-chime-secondary transition hover:bg-stone-200 hover:text-chime-text"
            aria-label="Cancel edit"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {!isEditing && replyingTo && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-stone-200 bg-chime-chat px-3 py-2.5">
          <div className="min-w-0 flex-1 border-l-2 border-chime-gold pl-3">
            <p className="text-xs font-bold text-chime-text">
              Replying to {replyProfileName}
            </p>

            <p className="mt-0.5 truncate text-xs text-chime-secondary">
              {replyingTo.content}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancelReply}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-chime-secondary transition hover:bg-stone-200 hover:text-chime-text"
            aria-label="Cancel reply"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          placeholder={
            isEditing
              ? "Edit message..."
              : replyingTo
                ? "Write a reply..."
                : "Send a message..."
          }
          value={content}
          onChange={handleTyping}
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-chime-chat px-4 py-3 text-sm text-chime-text outline-none placeholder:text-chime-secondary focus:border-chime-gold"
        />

        {isEditing && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="shrink-0 rounded-xl border border-stone-200 bg-chime-background px-4 py-3 font-semibold text-chime-secondary hover:bg-stone-100 hover:text-chime-text"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          className="shrink-0 rounded-xl bg-chime-gold px-5 py-3 font-semibold text-chime-text hover:bg-chime-bright"
        >
          {isEditing ? "Save" : "Send"}
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
