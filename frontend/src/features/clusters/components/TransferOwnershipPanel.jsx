import { useEffect, useState } from "react";
import { X, Crown, Users } from "lucide-react";
import { authFetch } from "../../../shared/utils/authFetch";
import { usePresence } from "../../../shared/context/PresenceContext";

function TransferOwnershipPanel({ isOpen, cluster, onClose, onTransferred }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const { getPresence } = usePresence();

  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !cluster?._id) {
      return;
    }

    let cancelled = false;

    const fetchMembers = async () => {
      setIsLoading(true);
      setError("");
      setSelectedMember(null);

      try {
        const response = await authFetch(
          `http://localhost:5000/api/clusters/${cluster._id}/members`,
        );

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(data.message || "Failed to load Cluster members.");
          setMembers([]);
          return;
        }

        const activeMembers = Array.isArray(data.members)
          ? data.members.filter(
              (member) =>
                member.user?._id &&
                String(member.user._id) !== String(user?._id),
            )
          : [];

        setMembers(activeMembers);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch Cluster members:", error);
          setError("Something went wrong. Please try again.");
          setMembers([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [isOpen, cluster?._id, user?._id]);

  if (!isOpen) {
    return null;
  }

  const getPresenceLabel = (userId) => {
    const presence = getPresence(userId);

    if (presence === "online") {
      return "Online";
    }

    if (presence === "away") {
      return "Away";
    }

    return "Offline";
  };

  const getPresenceDot = (userId) => {
    const presence = getPresence(userId);

    if (presence === "online") {
      return "bg-green-500";
    }

    if (presence === "away") {
      return "bg-amber-400";
    }

    return "bg-stone-400";
  };

  const handleSelectMember = (member) => {
    if (isTransferring) {
      return;
    }

    setSelectedMember((currentMember) => {
      if (currentMember?._id === member._id) {
        return null;
      }

      return member;
    });

    setError("");
  };

  const handleTransfer = async () => {
    if (!selectedMember?.user?._id || !cluster?._id || isTransferring) {
      return;
    }

    setIsTransferring(true);
    setError("");

    try {
      const response = await authFetch(
        `http://localhost:5000/api/clusters/${cluster._id}/ownership/${selectedMember.user._id}`,
        {
          method: "PATCH",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to transfer Cluster ownership.");
        return;
      }

      if (onTransferred) {
        onTransferred(data.cluster);
      }
    } catch (error) {
      console.error("Failed to transfer Cluster ownership:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsTransferring(false);
    }
  };

  const selectedUser = selectedMember?.user;

  const selectedDisplayName =
    selectedUser?.displayName || selectedUser?.username || "this member";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chime-gold text-chime-text">
              <Crown size={19} />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-bold text-chime-text">
                Transfer Ownership
              </h2>

              <p className="mt-0.5 text-xs text-chime-secondary">
                Choose a member to become the new owner.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isTransferring}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <p className="text-sm text-chime-secondary">Loading members...</p>
            </div>
          ) : error && members.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-5">
              <p className="text-center text-sm leading-5 text-red-600">
                {error}
              </p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chime-chat text-chime-secondary">
                <Users size={21} />
              </div>

              <p className="mt-3 text-sm font-semibold text-chime-text">
                No other members
              </p>

              <p className="mt-1 max-w-xs text-xs leading-5 text-chime-secondary">
                There are no other active members who can become the new owner.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {members.map((member) => {
                const memberUser = member.user;

                if (!memberUser?._id) {
                  return null;
                }

                const displayName =
                  memberUser.displayName || memberUser.username || "User";

                const username = memberUser.username || "user";

                const isSelected = selectedMember?._id === member._id;

                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => handleSelectMember(member)}
                    disabled={isTransferring}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "border-chime-gold bg-chime-gold/20"
                        : "border-transparent hover:bg-chime-selected"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold">
                      {memberUser.profilePicture ? (
                        <img
                          src={memberUser.profilePicture}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-chime-text">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-chime-background ${getPresenceDot(
                          memberUser._id,
                        )}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-chime-text">
                        {displayName}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-chime-secondary">
                        @{username} · {getPresenceLabel(memberUser._id)}
                      </p>
                    </div>

                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-chime-text bg-chime-text"
                          : "border-stone-300"
                      }`}
                    >
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-chime-background" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && members.length > 0 && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>

        {selectedMember && (
          <div className="border-t border-stone-200 bg-chime-chat px-5 py-4">
            <p className="text-sm font-semibold text-chime-text">
              Transfer ownership to {selectedDisplayName}?
            </p>

            <p className="mt-1 text-xs leading-5 text-chime-secondary">
              You will no longer be the Cluster owner and will become a regular
              member.
            </p>
          </div>
        )}

        <footer className="flex justify-end gap-3 border-t border-stone-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isTransferring}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleTransfer}
            disabled={!selectedMember || isTransferring}
            className="rounded-xl bg-chime-gold px-4 py-2.5 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTransferring ? "Transferring..." : "Transfer Ownership"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default TransferOwnershipPanel;
