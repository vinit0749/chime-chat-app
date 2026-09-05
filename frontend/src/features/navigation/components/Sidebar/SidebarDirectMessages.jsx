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
  renderPresenceIndicator,
}) {
  return (
    <div>
      <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-chime-secondary">
        Direct Messages
      </h2>

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

            return (
              <div
                key={conversation._id}
                className="relative"
                onContextMenu={(event) => onOpenDmMenu(conversation, event)}
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
                </button>

                {isMenuTarget && (
                  <DmContextMenu
                    user={conversation}
                    onViewProfile={onViewProfile}
                    onUnfriend={onUnfriend}
                    onBlock={onBlock}
                    onUnblock={onUnblock}
                    showUnfriend={isFriend(conversation._id)}
                    showBlock={!isBlockedByMe && !isBlockedByOther}
                    showUnblock={isBlockedByMe}
                  />
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
