import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Undo2, Reply, Pencil } from "lucide-react";

function Message({
  userId,
  displayName,
  username,
  profilePicture,
  time,
  content,
  status,
  showReadStatus = false,
  avatarColor = "bg-chime-gold",
  isOwnMessage,
  isGrouped,
  onOpenProfile,
  messageId,
  onUnsend,
  onReply,
  onEdit,
  replyTo,
  onJumpToMessage,
  isHighlighted = false,
  isEdited = false,
}) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  const messageRef = useRef(null);
  const bubbleRef = useRef(null);
  const longPressTimerRef = useRef(null);

  const profileName = displayName?.trim() || username || "Deleted User";

  const deliveryIndicator =
    status === "delivered" || status === "read" ? "✓✓" : "✓";

  /*
    ============================================================
    ACTION MENU
    ============================================================
  */

  const openActionMenu = () => {
    if (!bubbleRef.current) {
      return;
    }

    const bubble = bubbleRef.current;
    const rect = bubble.getBoundingClientRect();

    const chatArea = bubble.closest("main");

    const chatRect = chatArea
      ? chatArea.getBoundingClientRect()
      : {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        };

    /*
      Edit adds one extra menu item for own messages.
    */
    const menuWidth = 176;
    const menuHeight = isOwnMessage ? 176 : 96;

    const horizontalPadding = 12;

    const minLeft = chatRect.left + horizontalPadding;
    const maxLeft = chatRect.right - menuWidth - horizontalPadding;

    let left = isOwnMessage ? rect.right - menuWidth : rect.left;

    if (maxLeft >= minLeft) {
      left = Math.max(minLeft, Math.min(left, maxLeft));
    } else {
      left = minLeft;
    }

    let top = rect.top;

    const minTop = chatRect.top + 8;
    const maxTop = chatRect.bottom - menuHeight - 8;

    if (maxTop >= minTop) {
      top = Math.max(minTop, Math.min(top, maxTop));
    } else {
      top = minTop;
    }

    setMenuPosition({
      top,
      left,
    });

    setIsActionMenuOpen(true);
  };

  const closeActionMenu = () => {
    setIsActionMenuOpen(false);
  };

  /*
    ============================================================
    DESKTOP RIGHT CLICK
    ============================================================
  */

  const handleContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();

    openActionMenu();
  };

  /*
    ============================================================
    MOBILE LONG PRESS
    ============================================================
  */

  const handlePointerDown = (event) => {
    if (event.pointerType !== "touch") {
      return;
    }

    cancelLongPress();

    longPressTimerRef.current = setTimeout(() => {
      openActionMenu();
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  /*
    ============================================================
    CLOSE ACTION MENU
    ============================================================
  */

  useEffect(() => {
    if (!isActionMenuOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      const clickedInsideMessage = messageRef.current?.contains(event.target);

      const clickedInsideMenu = event.target.closest?.(
        "[data-chime-message-menu]",
      );

      if (!clickedInsideMessage && !clickedInsideMenu) {
        closeActionMenu();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeActionMenu();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isActionMenuOpen]);

  /*
    ============================================================
    CLEAN UP LONG PRESS
    ============================================================
  */

  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, []);

  /*
    ============================================================
    EDIT
    ============================================================

    IMPORTANT:

    Message no longer edits itself.

    Instead, it sends the complete message to ChatArea.
    ChatArea will pass it to MessageInput, where the normal
    message input becomes the edit input.
    ============================================================
  */

  const handleEdit = () => {
    if (!messageId || !isOwnMessage || !onEdit) {
      return;
    }

    closeActionMenu();

    onEdit({
      _id: messageId,
      content,
    });
  };

  /*
    ============================================================
    COPY
    ============================================================
  */

  const handleCopy = async () => {
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      closeActionMenu();
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  /*
    ============================================================
    REPLY
    ============================================================
  */

  const handleReply = () => {
    if (!messageId || !onReply) {
      return;
    }

    closeActionMenu();

    onReply({
      _id: messageId,
      content,
      sender: {
        _id: userId,
        username,
        displayName,
        profilePicture,
      },
    });
  };

  /*
    ============================================================
    UNSEND
    ============================================================
  */

  const handleUnsend = () => {
    if (!messageId || !onUnsend) {
      return;
    }

    closeActionMenu();
    onUnsend(messageId);
  };

  /*
    ============================================================
    JUMP TO REPLIED MESSAGE
    ============================================================
  */

  const handleJumpToReply = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!replyTo?._id || !onJumpToMessage) {
      return;
    }

    onJumpToMessage(String(replyTo._id));
  };

  /*
    ============================================================
    ACTION MENU
    ============================================================
  */

  const actionMenu = isActionMenuOpen
    ? createPortal(
        <div
          data-chime-message-menu
          className="fixed z-[9999] w-44 overflow-hidden rounded-xl border border-stone-200 bg-chime-background p-1.5 shadow-xl"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleReply}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-chime-text transition hover:bg-stone-100 active:bg-stone-200"
          >
            <Reply size={16} strokeWidth={2} />
            <span>Reply</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-chime-text transition hover:bg-stone-100 active:bg-stone-200"
          >
            <Copy size={16} strokeWidth={2} />
            <span>Copy</span>
          </button>

          {isOwnMessage && (
            <button
              type="button"
              onClick={handleEdit}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-chime-text transition hover:bg-stone-100 active:bg-stone-200"
            >
              <Pencil size={16} strokeWidth={2} />
              <span>Edit</span>
            </button>
          )}

          {isOwnMessage && (
            <button
              type="button"
              onClick={handleUnsend}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 active:bg-red-100"
            >
              <Undo2 size={16} strokeWidth={2} />
              <span>Unsend</span>
            </button>
          )}
        </div>,
        document.body,
      )
    : null;

  /*
    ============================================================
    REPLY PREVIEW
    ============================================================
  */

  const repliedProfileName =
    replyTo?.sender?.displayName || replyTo?.sender?.username || "Deleted User";

  /*
    ============================================================
    RENDER
    ============================================================
  */

  return (
    <>
      <div
        ref={messageRef}
        data-message-id={messageId}
        className={`flex w-full gap-3 rounded-xl px-0 transition-colors duration-300 ${
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        } ${isGrouped ? "mb-1" : "mb-4"} ${
          isHighlighted ? "bg-chime-gold/20 px-2 py-1" : ""
        }`}
      >
        {/* Avatar */}
        <button
          type="button"
          onClick={() => {
            if (userId && onOpenProfile) {
              onOpenProfile(userId);
            }
          }}
          disabled={!userId || !onOpenProfile}
          className={`h-10 w-10 shrink-0 overflow-hidden rounded-full ${avatarColor} ${
            isGrouped ? "invisible" : ""
          } ${
            userId && onOpenProfile
              ? "cursor-pointer transition hover:opacity-80"
              : "cursor-default"
          }`}
          aria-label={`View ${profileName}'s profile`}
        >
          {profilePicture ? (
            <img
              src={profilePicture}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className={`h-full w-full ${avatarColor}`} />
          )}
        </button>

        {/* Message Content */}
        <div
          className={`min-w-0 max-w-[70%] ${
            isOwnMessage ? "text-right" : "text-left"
          }`}
        >
          {/* User + Time */}
          {!isGrouped && (
            <div
              className={`mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
                isOwnMessage ? "justify-end" : "justify-start"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (userId && onOpenProfile) {
                    onOpenProfile(userId);
                  }
                }}
                disabled={!userId || !onOpenProfile}
                className={`font-bold text-chime-text ${
                  userId && onOpenProfile
                    ? "cursor-pointer hover:underline"
                    : "cursor-default"
                }`}
              >
                {profileName}
              </button>

              <span className="text-xs text-chime-secondary">{time}</span>
            </div>
          )}

          {/* Message Bubble */}
          <div
            ref={bubbleRef}
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerUp={cancelLongPress}
            onPointerMove={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            className={`inline-block select-text rounded-2xl border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              isOwnMessage
                ? "rounded-tr-md border-chime-gold bg-chime-gold text-chime-text"
                : "rounded-tl-md border-stone-200 bg-chime-background text-chime-text"
            }`}
          >
            {/* Replied Message Preview */}
            {replyTo && (
              <button
                type="button"
                onClick={handleJumpToReply}
                className="mb-2 block w-full overflow-hidden rounded-lg border-l-[3px] border-chime-gold bg-white px-3 py-2 text-left transition hover:bg-stone-50"
                aria-label={`Jump to message from ${repliedProfileName}`}
              >
                <p className="truncate text-[11px] font-bold text-chime-text">
                  {repliedProfileName}
                </p>

                <p className="mt-0.5 line-clamp-2 break-words text-xs text-chime-secondary">
                  {replyTo.content || "Message unavailable"}
                </p>
              </button>
            )}

            <span className="break-words">{content}</span>

            {/* Edited Label */}
            {isEdited && (
              <span className="ml-2 text-[10px] font-medium text-chime-secondary">
                Edited
              </span>
            )}

            {/* Delivery Indicator */}
            {isOwnMessage && (
              <span className="ml-2 text-[11px] font-semibold leading-none text-chime-secondary">
                {deliveryIndicator}
              </span>
            )}
          </div>

          {/* Read Label */}
          {showReadStatus && (
            <div className="mt-2 text-[11px] font-bold text-chime-secondary">
              Read
            </div>
          )}
        </div>
      </div>

      {actionMenu}
    </>
  );
}

export default Message;
