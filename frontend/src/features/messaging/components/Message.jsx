import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Undo2, Reply, Pencil } from "lucide-react";
import ClusterReadByModal from "./ClusterReadByModal";

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
  isClusterMessage = false,
  readBy = [],
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
  const [isReadByModalOpen, setIsReadByModalOpen] = useState(false);

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

  const readerNames = Array.isArray(readBy)
    ? readBy
        .map((reader) => reader.displayName?.trim() || reader.username?.trim())
        .filter(Boolean)
    : [];

  const readByLabel =
    readerNames.length === 1
      ? `Read by ${readerNames[0]}`
      : readerNames.length === 2
        ? `Read by ${readerNames[0]}, ${readerNames[1]}`
        : readerNames.length > 2
          ? `Read by ${readerNames[0]}, ${readerNames[1]} +${readerNames.length - 2} others`
          : null;

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

  const handleContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();

    openActionMenu();
  };

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

  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, []);

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

  const handleUnsend = () => {
    if (!messageId || !onUnsend) {
      return;
    }

    closeActionMenu();
    onUnsend(messageId);
  };

  const handleJumpToReply = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!replyTo?._id || !onJumpToMessage) {
      return;
    }

    onJumpToMessage(String(replyTo._id));
  };

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

  const repliedProfileName =
    replyTo?.sender?.displayName || replyTo?.sender?.username || "Deleted User";

  return (
    <>
      <div
        ref={messageRef}
        data-message-id={messageId}
        className={`flex w-full gap-0 rounded-xl px-0 transition-colors duration-300 sm:gap-3 ${
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        } mb-1 ${isHighlighted ? "bg-chime-gold/20 px-2 py-1" : ""}`}
      >
        <button
          type="button"
          onClick={() => {
            if (userId && onOpenProfile) {
              onOpenProfile(userId);
            }
          }}
          disabled={!userId || !onOpenProfile}
          className={`hidden h-10 w-10 shrink-0 overflow-hidden rounded-full sm:block ${avatarColor} ${
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

        <div
          className={`min-w-0 max-w-[70%] ${
            isOwnMessage ? "text-right" : "text-left"
          }`}
        >
          {!isGrouped && (
            <div className="mb-1 text-[11px] font-bold text-chime-secondary">
              {isOwnMessage ? "You" : profileName}
            </div>
          )}

          <div
            ref={bubbleRef}
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerUp={cancelLongPress}
            onPointerMove={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            className={`inline-block max-w-full select-text rounded-2xl border px-3.5 py-2 text-sm leading-relaxed ${
              isOwnMessage
                ? "rounded-tr-md border-chime-gold bg-chime-gold text-chime-text"
                : "rounded-tl-md border-stone-200 bg-chime-background text-chime-text"
            }`}
          >
            {replyTo && (
              <button
                type="button"
                onClick={handleJumpToReply}
                className="mb-1.5 block w-full overflow-hidden rounded-md border-l-[3px] border-chime-gold bg-white/70 px-2.5 py-1.5 text-left transition hover:bg-white"
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

            <div className="break-words">{content}</div>

            {isEdited && (
              <span className="mt-0.5 block text-[10px] font-medium text-chime-secondary">
                Edited
              </span>
            )}

            {!isGrouped && (
              <div
                className={`mt-0.5 text-[10px] leading-none ${
                  isOwnMessage ? "text-chime-text/60" : "text-chime-secondary"
                }`}
              >
                {time}

                {isOwnMessage && (
                  <span className="ml-1 text-[11px] font-semibold">
                    {deliveryIndicator}
                  </span>
                )}
              </div>
            )}
          </div>

          {isClusterMessage && isOwnMessage
            ? readByLabel && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setIsReadByModalOpen(true)}
                    className="text-[11px] font-bold text-chime-secondary transition hover:text-chime-text hover:underline"
                  >
                    {readByLabel}
                  </button>
                </div>
              )
            : showReadStatus && (
                <div className="mt-1 text-[11px] font-bold text-chime-secondary">
                  Read
                </div>
              )}
        </div>
      </div>

      {actionMenu}

      {isReadByModalOpen && (
        <ClusterReadByModal
          readers={readBy}
          onClose={() => setIsReadByModalOpen(false)}
        />
      )}
    </>
  );
}

export default Message;
