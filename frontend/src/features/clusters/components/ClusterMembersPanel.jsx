import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  MessageCircle,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { authFetch } from "../../../shared/utils/authFetch";
import { usePresence } from "../../../shared/context/PresenceContext";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import AddPeoplePanel from "./AddPeoplePanel";
import InvitePeoplePanel from "./InvitePeoplePanel";
import ClusterJoinRequestsPanel from "./ClusterJoinRequestsPanel";

function ClusterMembersPanel({
  isOpen,
  cluster,
  socket,
  onClose,
  onOpenProfile,
  onSelectChat,
}) {
  const { getPresence } = usePresence();

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);

  const currentUserId = currentUser?._id;

  const isClusterOwner =
    String(cluster?.owner?._id || cluster?.owner) === String(currentUserId);

  const isPrivateCluster = cluster?.visibility === "private";

  const [members, setMembers] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [requestUser, setRequestUser] = useState(null);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isAddPeopleOpen, setIsAddPeopleOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [isKicking, setIsKicking] = useState(false);
  const [kickError, setKickError] = useState("");

  useEffect(() => {
    if (!isOpen || !cluster?._id) {
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [membersResponse, friendsResponse] = await Promise.all([
          authFetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${cluster._id}/members`,
          ),
          authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/friends`),
        ]);

        const membersData = await membersResponse.json();
        const friendsData = await friendsResponse.json();

        if (cancelled) {
          return;
        }

        if (!membersResponse.ok) {
          setError(membersData.message || "Failed to load Cluster members.");
          setMembers([]);
          return;
        }

        setMembers(
          Array.isArray(membersData.members) ? membersData.members : [],
        );

        setMemberCount(
          typeof membersData.cluster?.memberCount === "number"
            ? membersData.cluster.memberCount
            : Array.isArray(membersData.members)
              ? membersData.members.length
              : 0,
        );

        if (friendsResponse.ok) {
          setFriends(
            Array.isArray(friendsData.friends) ? friendsData.friends : [],
          );
        } else {
          setFriends([]);
        }
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

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, cluster?._id]);

  useEffect(() => {
    if (!socket || !cluster?._id) {
      return;
    }

    const handleMemberUpdated = (data) => {
      if (String(data?.clusterId) !== String(cluster._id)) {
        return;
      }

      if (Array.isArray(data.members)) {
        setMembers(data.members);
      }

      if (typeof data.memberCount === "number") {
        setMemberCount(data.memberCount);
      } else if (Array.isArray(data.members)) {
        setMemberCount(data.members.length);
      }
    };

    socket.on("cluster_member_updated", handleMemberUpdated);

    return () => {
      socket.off("cluster_member_updated", handleMemberUpdated);
    };
  }, [socket, cluster?._id]);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setRequestUser(null);
      setIsAddPeopleOpen(false);
      setKickTarget(null);
      setKickError("");
    }
  }, [isOpen]);

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

  const isCurrentUser = (userId) => {
    return String(userId) === String(currentUserId);
  };

  const isFriend = (userId) => {
    return friends.some((friend) => String(friend?._id) === String(userId));
  };

  const hasSentRequest = (userId) => {
    return sentRequests.some(
      (request) => String(request?._id) === String(userId),
    );
  };

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return members;
    }

    return members.filter((member) => {
      const user = member.user;

      if (!user) {
        return false;
      }

      const displayName = String(user.displayName || "").toLowerCase();
      const username = String(user.username || "").toLowerCase();

      return (
        displayName.includes(normalizedSearch) ||
        username.includes(normalizedSearch)
      );
    });
  }, [members, search]);

  const handleOpenProfile = (userId) => {
    if (!userId || !onOpenProfile || isCurrentUser(userId)) {
      return;
    }

    onOpenProfile(userId);
  };

  const handleMessage = (user) => {
    if (!user?._id || !onSelectChat || isCurrentUser(user._id)) {
      return;
    }

    onClose();

    onSelectChat({
      type: "dm",
      user,
      isFriend: true,
    });
  };

  const handleSendRequestClick = (user) => {
    if (
      !user?._id ||
      isCurrentUser(user._id) ||
      isFriend(user._id) ||
      hasSentRequest(user._id)
    ) {
      return;
    }

    setRequestUser(user);
  };

  const closeRequestModal = () => {
    if (isSendingRequest) {
      return;
    }

    setRequestUser(null);
  };

  const handleSendRequest = async () => {
    if (
      !requestUser?._id ||
      isCurrentUser(requestUser._id) ||
      isSendingRequest
    ) {
      return;
    }

    setIsSendingRequest(true);

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/friends/request/${requestUser._id}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to send friend request.");
        return;
      }

      setSentRequests((currentRequests) => {
        if (
          currentRequests.some(
            (request) => String(request?._id) === String(requestUser._id),
          )
        ) {
          return currentRequests;
        }

        return [...currentRequests, requestUser];
      });

      setRequestUser(null);
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleMemberAdded = (user) => {
    setMembers((currentMembers) => {
      if (
        currentMembers.some(
          (member) => String(member?.user?._id) === String(user?._id),
        )
      ) {
        return currentMembers;
      }

      return [
        ...currentMembers,
        {
          _id: `local-${user._id}`,
          user,
          role: "member",
          status: "active",
        },
      ];
    });

    setMemberCount((currentCount) => currentCount + 1);
  };

  const handleKickClick = (user) => {
    if (!isClusterOwner || !user?._id || isCurrentUser(user._id) || isKicking) {
      return;
    }

    setKickError("");
    setKickTarget(user);
  };

  const handleKick = async () => {
    if (!cluster?._id || !kickTarget?._id || !isClusterOwner || isKicking) {
      return;
    }

    setIsKicking(true);
    setKickError("");

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/clusters/${cluster._id}/members/${kickTarget._id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setKickError(data.message || "Failed to kick member.");
        return;
      }

      const targetId = String(kickTarget._id);

      setMembers((currentMembers) =>
        currentMembers.filter(
          (member) => String(member?.user?._id) !== targetId,
        ),
      );

      setMemberCount((currentCount) =>
        Math.max(0, data.memberCount ?? currentCount - 1),
      );

      setKickTarget(null);
    } catch (error) {
      console.error("Failed to kick Cluster member:", error);
      setKickError("Something went wrong. Please try again.");
    } finally {
      setIsKicking(false);
    }
  };

  const renderRelationshipAction = (user) => {
    if (!user?._id || isCurrentUser(user._id)) {
      return null;
    }

    if (isFriend(user._id)) {
      return (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title="Already friends"
        >
          <Check size={16} />
        </span>
      );
    }

    if (hasSentRequest(user._id)) {
      return (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title="Friend request sent"
        >
          <Clock size={16} />
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleSendRequestClick(user);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-chime-text transition hover:bg-chime-gold"
        title="Add friend"
      >
        <UserPlus size={16} />
      </button>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
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

          <div className="shrink-0 border-b border-stone-200 px-3 py-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-chime-secondary"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search members"
                  className="h-10 w-full rounded-xl border border-stone-200 bg-chime-chat pl-9 pr-3 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-stone-300 focus:ring-2 focus:ring-stone-200"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddPeopleOpen(true)}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-chime-gold px-3 text-xs font-bold text-chime-text transition hover:opacity-90"
              >
                <UserPlus size={15} />
                <span>{isPrivateCluster ? "Invite People" : "Add People"}</span>
              </button>
            </div>
          </div>

          {isClusterOwner && isPrivateCluster && (
            <ClusterJoinRequestsPanel cluster={cluster} socket={socket} />
          )}

          <div className="chime-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex h-full items-center justify-center px-5">
                <p className="text-sm text-chime-secondary">
                  Loading members...
                </p>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-5">
                <p className="text-center text-sm leading-5 text-red-600">
                  {error}
                </p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex h-full items-center justify-center px-5">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-chime-chat text-chime-secondary">
                    <Users size={20} />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-chime-text">
                    No members found
                  </p>

                  <p className="mt-1 text-xs text-chime-secondary">
                    {search.trim()
                      ? "Try a different name or username."
                      : "This Cluster doesn't have any active members."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredMembers.map((member) => {
                  const memberUser = member.user;

                  if (!memberUser?._id) {
                    return null;
                  }

                  const self = isCurrentUser(memberUser._id);

                  const displayName = self
                    ? "You"
                    : memberUser.displayName || memberUser.username || "User";

                  const username = memberUser.username || "user";
                  const presence = getPresenceLabel(memberUser._id);
                  const memberIsOwner = member.role === "owner";

                  return (
                    <div
                      key={member._id}
                      className="group rounded-xl px-3 py-2.5 transition hover:bg-chime-selected"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(memberUser._id)}
                          disabled={self}
                          className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold ${
                            self
                              ? "cursor-default"
                              : "transition hover:opacity-80"
                          }`}
                          aria-label={
                            self
                              ? "Your profile"
                              : `View ${displayName}'s profile`
                          }
                        >
                          {memberUser.profilePicture ? (
                            <img
                              src={memberUser.profilePicture}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-chime-text">
                              {(self
                                ? currentUser?.displayName ||
                                  currentUser?.username ||
                                  "Y"
                                : displayName
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <span
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-chime-background ${getPresenceDot(
                              memberUser._id,
                            )}`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenProfile(memberUser._id)}
                          disabled={self}
                          className={`min-w-0 flex-1 text-left ${
                            self ? "cursor-default" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-chime-text">
                              {displayName}
                            </p>

                            {memberIsOwner && (
                              <span className="shrink-0 rounded-md bg-chime-gold px-1.5 py-0.5 text-[10px] font-bold text-chime-text">
                                Owner
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 truncate text-xs text-chime-secondary">
                            @{username} · {presence}
                          </p>
                        </button>

                        {!self && (
                          <div className="flex shrink-0 items-center gap-1">
                            {isFriend(memberUser._id) && (
                              <button
                                type="button"
                                onClick={() => handleMessage(memberUser)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-gold hover:text-chime-text"
                                title={`Message ${displayName}`}
                                aria-label={`Message ${displayName}`}
                              >
                                <MessageCircle size={16} />
                              </button>
                            )}

                            {isClusterOwner && !memberIsOwner && (
                              <button
                                type="button"
                                onClick={() => handleKickClick(memberUser)}
                                disabled={isKicking}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                title={`Kick ${displayName}`}
                                aria-label={`Kick ${displayName}`}
                              >
                                <UserMinus size={16} />
                              </button>
                            )}

                            {renderRelationshipAction(memberUser)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {isPrivateCluster ? (
        <InvitePeoplePanel
          isOpen={isAddPeopleOpen}
          cluster={cluster}
          friends={friends}
          members={members}
          socket={socket}
          onClose={() => setIsAddPeopleOpen(false)}
          onOpenProfile={handleOpenProfile}
        />
      ) : (
        <AddPeoplePanel
          isOpen={isAddPeopleOpen}
          cluster={cluster}
          friends={friends}
          members={members}
          onClose={() => setIsAddPeopleOpen(false)}
          onOpenProfile={handleOpenProfile}
          onMemberAdded={handleMemberAdded}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(requestUser)}
        title="Send friend request?"
        message={`Send a friend request to ${
          requestUser?.username || "this user"
        }?`}
        confirmText="Send Request"
        cancelText="Cancel"
        onConfirm={handleSendRequest}
        onCancel={closeRequestModal}
        loading={isSendingRequest}
      />

      <ConfirmModal
        isOpen={Boolean(kickTarget)}
        title="Kick Member"
        message={`Are you sure you want to kick ${
          kickTarget?.displayName || kickTarget?.username || "this member"
        } from ${cluster?.name || "this Cluster"}?`}
        confirmText={isKicking ? "Kicking..." : "Kick Member"}
        cancelText="Cancel"
        onConfirm={handleKick}
        onCancel={() => {
          if (!isKicking) {
            setKickTarget(null);
          }
        }}
        loading={isKicking}
      />
    </>
  );
}

export default ClusterMembersPanel;
