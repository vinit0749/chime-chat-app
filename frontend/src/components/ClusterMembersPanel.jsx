import { useEffect, useState } from "react";
import { X, Users } from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { usePresence } from "../context/PresenceContext";

function ClusterMembersPanel({ isOpen, cluster, onClose, onOpenProfile }) {
  const { getPresence } = usePresence();

  const [members, setMembers] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !cluster?._id) {
      return;
    }

    let cancelled = false;

    const fetchMembers = async () => {
      setIsLoading(true);
      setError("");

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

        setMembers(Array.isArray(data.members) ? data.members : []);
        setMemberCount(data.cluster?.memberCount || 0);
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
  }, [isOpen, cluster?._id]);

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

  const handleOpenProfile = (userId) => {
    if (!userId || !onOpenProfile) {
      return;
    }

    onOpenProfile(userId);
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/20"
        aria-label="Close members panel"
      />

      <aside className="relative z-10 flex h-full w-full max-w-sm flex-col border-l border-stone-200 bg-chime-background shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chime-gold text-chime-text">
              <Users size={18} />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-chime-text">
                Members
              </h2>

              <p className="text-xs text-chime-secondary">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex h-full items-center justify-center px-5">
              <p className="text-sm text-chime-secondary">Loading members...</p>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-5">
              <p className="text-center text-sm leading-5 text-red-600">
                {error}
              </p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex h-full items-center justify-center px-5">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-chime-chat text-chime-secondary">
                  <Users size={20} />
                </div>

                <p className="mt-3 text-sm font-semibold text-chime-text">
                  No members found
                </p>

                <p className="mt-1 text-xs text-chime-secondary">
                  This Cluster doesn't have any active members.
                </p>
              </div>
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

                const presence = getPresenceLabel(memberUser._id);

                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => handleOpenProfile(memberUser._id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-chime-selected"
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
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-chime-text">
                          {displayName}
                        </p>

                        {member.role === "owner" && (
                          <span className="shrink-0 rounded-md bg-chime-gold px-1.5 py-0.5 text-[10px] font-bold text-chime-text">
                            Owner
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-xs text-chime-secondary">
                        @{username} · {presence}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default ClusterMembersPanel;
