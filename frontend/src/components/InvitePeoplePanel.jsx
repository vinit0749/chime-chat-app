import { useMemo, useState } from "react";
import { Check, Search, UserPlus, Users, X } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

function InvitePeoplePanel({
  isOpen,
  cluster,
  friends,
  members,
  socket,
  onClose,
  onOpenProfile,
}) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState([]);
  const [error, setError] = useState("");

  const isMember = (userId) => {
    return members.some(
      (member) => String(member?.user?._id) === String(userId),
    );
  };

  const filteredFriends = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return friends.filter((friend) => {
      if (!friend?._id || isMember(friend._id)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const displayName = String(friend.displayName || "").toLowerCase();
      const username = String(friend.username || "").toLowerCase();

      return (
        displayName.includes(normalizedSearch) ||
        username.includes(normalizedSearch)
      );
    });
  }, [friends, members, search]);

  const handleInviteClick = (user) => {
    if (
      !user?._id ||
      isMember(user._id) ||
      invitedUserIds.some((id) => String(id) === String(user._id))
    ) {
      return;
    }

    setError("");
    setSelectedUser(user);
  };

  const handleInvite = () => {
    if (
      !socket ||
      !socket.connected ||
      !cluster?._id ||
      !selectedUser?._id ||
      isSending
    ) {
      return;
    }

    const invitedUserId = selectedUser._id;

    setIsSending(true);
    setError("");

    socket.emit(
      "send_cluster_invitation",
      {
        clusterId: cluster._id,
        recipient: invitedUserId,
      },
      (response) => {
        if (!response?.ok) {
          setIsSending(false);
          setError(response?.message || "Failed to send invitation.");
          return;
        }

        setInvitedUserIds((currentIds) => {
          if (currentIds.some((id) => String(id) === String(invitedUserId))) {
            return currentIds;
          }

          return [...currentIds, invitedUserId];
        });

        setIsSending(false);
        setSelectedUser(null);
      },
    );
  };

  const handleClose = () => {
    if (isSending) {
      return;
    }

    setSelectedUser(null);
    setSearch("");
    setError("");
    onClose?.();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="flex max-h-[min(620px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl">
          <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-chime-text">
                Invite People
              </h2>

              <p className="mt-0.5 text-xs text-chime-secondary">
                Invite friends to {cluster?.name || "this Cluster"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isSending}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close"
            >
              <X size={19} />
            </button>
          </header>

          <div className="shrink-0 border-b border-stone-200 px-4 py-3">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-chime-secondary"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search friends"
                className="h-10 w-full rounded-xl border border-stone-200 bg-chime-chat pl-9 pr-3 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-stone-300 focus:ring-2 focus:ring-stone-200"
              />
            </div>

            {error && (
              <p className="mt-2 text-xs leading-5 text-red-600">{error}</p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filteredFriends.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center px-5">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-chime-chat text-chime-secondary">
                    <Users size={20} />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-chime-text">
                    {search.trim()
                      ? "No friends found"
                      : "No friends to invite"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-chime-secondary">
                    {search.trim()
                      ? "Try a different name or username."
                      : "All of your friends are already in this Cluster."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredFriends.map((friend) => {
                  const displayName =
                    friend.displayName || friend.username || "User";

                  const isInvited = invitedUserIds.some(
                    (id) => String(id) === String(friend._id),
                  );

                  return (
                    <div
                      key={friend._id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-chime-selected"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenProfile?.(friend._id)}
                        className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold transition hover:opacity-80"
                        aria-label={`View ${displayName}'s profile`}
                      >
                        {friend.profilePicture ? (
                          <img
                            src={friend.profilePicture}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-chime-text">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenProfile?.(friend._id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-semibold text-chime-text">
                          {displayName}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-chime-secondary">
                          @{friend.username || "user"}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInviteClick(friend)}
                        disabled={isSending || isInvited}
                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                          isInvited
                            ? "bg-chime-selected text-chime-secondary"
                            : "bg-chime-gold text-chime-text hover:opacity-90"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        {isInvited ? (
                          <>
                            <Check size={14} />
                            Invited
                          </>
                        ) : (
                          <>
                            <UserPlus size={14} />
                            Invite
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-stone-200 px-4 py-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSending}
              className="w-full rounded-xl border border-stone-200 bg-chime-chat px-4 py-2.5 text-sm font-bold text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-70"
            >
              Done
            </button>
          </footer>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(selectedUser)}
        title="Send Invitation?"
        message={`Invite ${
          selectedUser?.displayName || selectedUser?.username || "this person"
        } to ${cluster?.name || "this Cluster"}?`}
        confirmText={isSending ? "Sending..." : "Send Invitation"}
        cancelText="Cancel"
        onConfirm={handleInvite}
        onCancel={() => {
          if (!isSending) {
            setSelectedUser(null);
          }
        }}
        loading={isSending}
      />
    </>
  );
}

export default InvitePeoplePanel;
