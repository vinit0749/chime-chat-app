import { Compass, LogOut, User, Users } from "lucide-react";

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
    <div className="border-t border-stone-200 pt-2">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={onDiscover}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
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

          <span>Discover</span>
        </button>

        <button
          type="button"
          onClick={onOpenFriends}
          className={`relative flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
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

          <span>Friends</span>

          {requests.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chime-gold px-1.5 text-[11px] font-bold text-chime-text">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      <div className="mt-2.5 border-t border-stone-200 pt-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className={`flex min-w-0 min-h-12 flex-1 items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
              activeView === "profile"
                ? "bg-chime-selected"
                : "hover:bg-chime-selected"
            }`}
            title="Open profile"
          >
            <div className="relative h-10 w-10 shrink-0">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chime-gold text-chime-text">
                  <User size={20} />
                </div>
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SidebarFooter;
