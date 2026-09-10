import { MessageCircle, Search, UserPlus, Check, Clock } from "lucide-react";

function SidebarSearch({
  search,
  searchResults,
  isSearching,
  searchRef,
  onSearchChange,
  onOpenProfile,
  onMessageUser,
  onAddFriend,
  renderPresenceIndicator,
}) {
  const renderRelationshipButton = (person) => {
    if (person.relationshipStatus === "friends") {
      return (
        <button
          type="button"
          disabled
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary md:h-8 md:w-8"
          title="Already friends"
        >
          <Check size={16} />
        </button>
      );
    }

    if (
      person.relationshipStatus === "sent" ||
      person.relationshipStatus === "received"
    ) {
      return (
        <button
          type="button"
          disabled
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary md:h-8 md:w-8"
          title={
            person.relationshipStatus === "sent"
              ? "Friend request sent"
              : "Friend request received"
          }
        >
          <Clock size={16} />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAddFriend(person);
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-chime-text transition hover:bg-chime-gold md:h-8 md:w-8"
        title="Add friend"
        aria-label="Add friend"
      >
        <UserPlus size={16} />
      </button>
    );
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="flex min-h-11 items-center rounded-xl border border-stone-200 bg-chime-chat px-3">
        <Search size={17} className="shrink-0 text-chime-secondary" />

        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Find people..."
          className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-chime-text outline-none placeholder:text-chime-secondary"
        />
      </div>

      {search.trim() && (
        <div className="absolute left-0 right-0 top-12 z-30 max-h-[min(60vh,28rem)] overflow-y-auto rounded-xl border border-stone-200 bg-chime-background shadow-lg">
          {isSearching ? (
            <p className="px-4 py-3 text-sm text-chime-secondary">
              Searching...
            </p>
          ) : searchResults.length === 0 ? (
            <p className="px-4 py-3 text-sm text-chime-secondary">
              No users found
            </p>
          ) : (
            searchResults.map((person) => (
              <div
                key={person._id}
                className="flex min-h-14 items-center gap-2 px-3 py-2 transition hover:bg-chime-selected"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(person)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  title="View profile"
                >
                  <div className="relative h-9 w-9 shrink-0">
                    {person.profilePicture ? (
                      <img
                        src={person.profilePicture}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-chime-gold" />
                    )}

                    {renderPresenceIndicator(person._id)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-chime-text hover:underline">
                      {person.displayName || `@${person.username}`}
                    </p>

                    {person.displayName && (
                      <p className="truncate text-xs text-chime-secondary">
                        @{person.username}
                      </p>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMessageUser(person);
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-gold hover:text-chime-text md:h-8 md:w-8"
                  title={`Message ${
                    person.displayName || `@${person.username}`
                  }`}
                  aria-label={`Message ${
                    person.displayName || person.username
                  }`}
                >
                  <MessageCircle size={16} />
                </button>

                {renderRelationshipButton(person)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default SidebarSearch;
