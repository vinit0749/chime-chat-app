import { Compass, LogOut, Users, X } from "lucide-react";

function SidebarFooter({
  mobile,
  onClose,
  activeView,
  requests,
  user,
  onDiscover,
  onOpenFriends,
  onOpenProfile,
  onLogout,
  renderPresenceIndicator,
}) {
  return (
    <>
      <div className="mt-auto space-y-2 border-t border-stone-200 pt-4">
        <button
          type="button"
          onClick={onDiscover}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
            activeView === "discover"
              ? "bg-chime-selected text-chime-text"
              : "text-chime-text hover:bg-chime-selected"
          }`}
        >
          <Compass
            size={18}
            className={
              activeView === "discover"
                ? "text-chime-text"
                : "text-chime-secondary"
            }
          />

          <span className="min-w-0 flex-1 truncate">Discover</span>
        </button>

        <button
          type="button"
          onClick={onOpenFriends}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
            activeView === "friends"
              ? "bg-chime-selected text-chime-text"
              : "text-chime-text hover:bg-chime-selected"
          }`}
        >
          <Users
            size={18}
            className={
              activeView === "friends"
                ? "text-chime-text"
                : "text-chime-secondary"
            }
          />

          <span className="min-w-0 flex-1 truncate">Friends</span>

          {requests.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chime-gold px-1.5 text-xs font-bold text-chime-text">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      <div className="shrink-0 border-t border-stone-200 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition ${
              activeView === "profile"
                ? "bg-chime-selected"
                : "hover:bg-chime-selected"
            }`}
            title="Open profile"
          >
            <div className="relative h-12 w-12 shrink-0">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-chime-gold" />
              )}

              {user?._id && renderPresenceIndicator(user._id)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-chime-text">
                {user?.displayName || `@${user?.username || "user"}`}
              </p>

              {user?.displayName && (
                <p className="truncate text-xs text-chime-secondary">
                  @{user?.username || "user"}
                </p>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 rounded-lg p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

export default SidebarFooter;
