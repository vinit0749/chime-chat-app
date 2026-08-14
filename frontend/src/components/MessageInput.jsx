import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { authFetch } from "../utils/authFetch";

function MessageInput({
  socket,
  selectedChat,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onMessageEdited,
}) {
  const [content, setContent] = useState("");
  const inputRef = useRef(null);

  /*
    ============================================================
    LOAD MESSAGE INTO INPUT WHEN EDITING STARTS
    ============================================================
  */
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content || "");

      /*
        Focus the input and place the cursor
        at the end of the message.
      */
      requestAnimationFrame(() => {
        inputRef.current?.focus();

        const length = inputRef.current?.value.length || 0;

        inputRef.current?.setSelectionRange(length, length);
      });
    }
  }, [editingMessage]);

  /*
    ============================================================
    FOCUS INPUT WHEN REPLYING
    ============================================================
  */
  useEffect(() => {
    if (replyingTo && !editingMessage) {
      inputRef.current?.focus();
    }
  }, [replyingTo, editingMessage]);

  /*
    ============================================================
    CANCEL EDIT
    ============================================================
  */
  const handleCancelEdit = () => {
    setContent("");

    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  /*
    ============================================================
    SUBMIT
    ============================================================
  */
  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    /*
      ==========================================================
      EDIT MODE
      ==========================================================
    */
    if (editingMessage) {
      const originalContent = editingMessage.content?.trim() || "";

      /*
        Nothing actually changed.

        Close edit mode without sending a PATCH request
        and without marking the message as edited.
      */
      if (trimmedContent === originalContent) {
        setContent("");

        if (onCancelEdit) {
          onCancelEdit();
        }

        return;
      }

      try {
        const response = await authFetch(
          `http://localhost:5000/api/messages/${editingMessage._id}`,
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

        /*
          Tell ChatArea to update the message immediately.
        */
        if (onMessageEdited) {
          onMessageEdited(editingMessage._id, trimmedContent);
        }

        /*
          Return input to normal Send mode.
        */
        setContent("");

        if (onCancelEdit) {
          onCancelEdit();
        }
      } catch (error) {
        console.error("Failed to edit message:", error);
      }

      return;
    }

    /*
      ==========================================================
      NORMAL SEND MODE
      ==========================================================
    */
    if (!socket || !socket.connected) {
      console.error("Socket is not connected");
      return;
    }

    const messageData = {
      content: trimmedContent,
    };

    /*
      Add the destination depending on
      whether this is a DM or public room.
    */
    if (selectedChat?.type === "dm") {
      messageData.recipient = selectedChat.user._id;
    } else if (selectedChat?.type === "room") {
      messageData.room = selectedChat.room || "general";
    } else {
      return;
    }

    /*
      If the user is replying to a message,
      send that message's ID to the backend.
    */
    if (replyingTo?._id) {
      messageData.replyTo = replyingTo._id;
    }

    socket.emit("send_message", messageData);

    /*
      Clear the input after sending.
    */
    setContent("");

    /*
      Clear the active reply.
    */
    if (replyingTo && onCancelReply) {
      onCancelReply();
    }
  };

  const replyProfileName =
    replyingTo?.sender?.displayName?.trim() ||
    replyingTo?.sender?.username ||
    "Deleted User";

  const isEditing = Boolean(editingMessage);

  return (
    <div className="border-t border-stone-200 bg-chime-background p-4">
      {/* Edit Preview */}
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

      {/* Reply Preview */}
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
          onChange={(event) => setContent(event.target.value)}
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
