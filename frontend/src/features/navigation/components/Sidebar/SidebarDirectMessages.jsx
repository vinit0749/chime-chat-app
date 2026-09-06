import { createPortal } from "react-dom";
import { Pin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DmContextMenu from "../../../messaging/components/DmContextMenu";

function SidebarDirectMessages({
  conversations,
  loadingConversations,
  dmMenu,
  blockedUserIds,
  blockedByUserIds,
  activeView,
  isFriend,
  onOpenDmMenu,
  onStartDmLongPress,
  onCancelDmLongPress,
  onCloseDmMenu,
  onSelectConversation,
  onViewProfile,
  onUnfriend,
  onBlock,
  onUnblock,
  onClearChat,
  onPinConversation,
  onUnpinConversation,
  renderPresenceIndicator,
}) {
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);

  const formatUnreadCount = (count) => {
    const unreadCount = Number(count) || 0;

    if (unreadCount <= 0) {
      return null;
    }

    return unreadCount >= 10 ? "10+" : unreadCount;
  };

  useEffect(() => {
    if (!dmMenu.isOpen) {
      setMenuPosition(null);
    }
  }, [dmMenu.isOpen]);

  useEffect(() => {
    if (!dmMenu.isOpen || !menuPosition) {
      return;
    }

    const handleScroll = () => {
      onCloseDmMenu();
    };

    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [dmMenu.isOpen, menuPosition, onCloseDmMenu]);

  return (
    <div>
      {loadingConversations ? (
        <p className="px-2 py-2 text-sm text-chime-secondary">Loading...</p>
      ) : conversations.length === 0 ? (
        <p className="px-2 py-2 text-sm leading-5 text-chime-secondary">
          No conversations yet.
          <br />
          Search for someone above to get started.
        </p>
      ) : (
        <div className="space-y-1">
          {conversations.map((conversation) => {
            const conversationId = String(conversation._id);

            const isMenuTarget =
              dmMenu.isOpen && String(dmMenu.user?._id) === conversationId;

            const isBlockedByMe = blockedUserIds.has(conversationId);
            const isBlockedByOther = blockedByUserIds.has(conversationId);
            const isPinned = Boolean(conversation.isPinned);
            const unreadCount = formatUnreadCount(conversation.unreadCount);

            return (
              <div
                key={conversation._id}
                className="relative"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const rect = event.currentTarget.getBoundingClientRect();

                  setMenuPosition({
                    top: rect.top,
                    left: rect.right,
                  });

                  onOpenDmMenu(conversation, event);
                }}
                onTouchStart={() => onStartDmLongPress(conversation)}
                onTouchEnd={onCancelDmLongPress}
                onTouchMove={onCancelDmLongPress}
                onTouchCancel={onCancelDmLongPress}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isMenuTarget) {
                      onCloseDmMenu();
                      return;
                    }

                    onSelectConversation(conversation);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition hover:bg-chime-selected"
                >
                  <div className="relative h-10 w-10 shrink-0">
                    {conversation.profilePicture ? (
                      <img
                        src={conversation.profilePicture}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-chime-gold" />
                    )}

                    {renderPresenceIndicator(conversation._id)}
                  </div>

                  <span className="min-w-0 flex-1 truncate">
                    {conversation.displayName || `@${conversation.username}`}
                  </span>

                  {isPinned && (
                    <Pin
                      size={18}
                      strokeWidth={2.5}
                      className="shrink-0 rotate-45 text-chime-gold"
                    />
                  )}

                  {unreadCount !== null && (
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-chime-gold px-2 text-[11px] font-bold text-chime-text">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {isMenuTarget &&
                  menuPosition &&
                  createPortal(
                    <div
                      ref={menuRef}
                      className="fixed z-[99999]"
                      style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                      }}
                    >
                      <DmContextMenu
                        user={conversation}
                        onViewProfile={onViewProfile}
                        onUnfriend={onUnfriend}
                        onBlock={onBlock}
                        onUnblock={onUnblock}
                        onClearChat={() => onClearChat(conversation)}
                        onPin={() => onPinConversation(conversation)}
                        onUnpin={() => onUnpinConversation(conversation)}
                        isPinned={isPinned}
                        showUnfriend={isFriend(conversation._id)}
                        showBlock={!isBlockedByMe && !isBlockedByOther}
                        showUnblock={isBlockedByMe}
                      />
                    </div>,
                    document.body,
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SidebarDirectMessages;
