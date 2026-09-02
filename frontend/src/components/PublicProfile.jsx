import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  MessageCircle,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Clock3,
  UserRoundX,
  UserRoundCheck,
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import ConfirmModal from "./ConfirmModal";

const SOCKET_URL = "http://localhost:5000";

function PublicProfile({ userId, onBack, onMessage }) {
  const [profile, setProfile] = useState({
    _id: "",
    username: "",
    displayName: "",
    bio: "",
    profilePicture: "",
  });

  const [relationshipStatus, setRelationshipStatus] = useState("none");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isFriendRequestLoading, setIsFriendRequestLoading] = useState(false);

  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [isUnfriending, setIsUnfriending] = useState(false);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const [isUnblocking, setIsUnblocking] = useState(false);

  /*
    ============================================================
    LOAD PUBLIC PROFILE
    ============================================================
  */

  const fetchProfile = useCallback(
    async (showLoading = false) => {
      if (!userId) {
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }

        setError("");

        const response = await authFetch(
          `http://localhost:5000/api/users/${userId}`,
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to load profile.");
          return;
        }

        setProfile({
          _id: data.user._id || userId,
          username: data.user.username || "",
          displayName: data.user.displayName || "",
          bio: data.user.bio || "",
          profilePicture: data.user.profilePicture || "",
        });

        /*
          relationshipStatus is authoritative.

          Fall back to isFriend for compatibility with any
          older backend response.
        */
        setRelationshipStatus(
          data.user.relationshipStatus ||
            (data.user.isFriend ? "friends" : "none"),
        );
      } catch (error) {
        console.error("Failed to load public profile:", error);

        if (showLoading) {
          setError("Failed to load profile.");
        }
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  /*
    Initial profile load.
  */
  useEffect(() => {
    fetchProfile(true);
  }, [fetchProfile]);

  /*
    ============================================================
    REAL-TIME RELATIONSHIP SYNC
    ============================================================
  */

  useEffect(() => {
    if (!userId) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    const normalizedProfileId = String(userId);

    const socket = io(SOCKET_URL, {
      auth: {
        token,
      },
    });

    /*
      Any relationship-changing event involving this profile
      causes the profile to immediately retrieve the authoritative
      relationship state from the backend.

      This is NOT refresh-dependent.

      The Socket.IO event is what triggers the synchronization.
    */
    const syncRelationship = () => {
      fetchProfile(false);
    };

    /*
      Friend request events.
    */
    socket.on("friend_request_received", syncRelationship);
    socket.on("friend_request_sent", syncRelationship);
    socket.on("friend_request_accepted", syncRelationship);
    socket.on("friend_request_rejected", syncRelationship);

    /*
      Friendship removal.
    */
    socket.on("friend_removed", syncRelationship);

    /*
      Blocking events.
    */
    socket.on("user_blocked", syncRelationship);
    socket.on("user_blocked_by_other", syncRelationship);
    socket.on("user_unblocked", syncRelationship);

    /*
      If the socket connection is established after the initial
      profile request, sync once so the realtime view starts from
      the latest backend state.
    */
    socket.on("connect", () => {
      fetchProfile(false);
    });

    return () => {
      socket.off("friend_request_received", syncRelationship);
      socket.off("friend_request_sent", syncRelationship);
      socket.off("friend_request_accepted", syncRelationship);
      socket.off("friend_request_rejected", syncRelationship);

      socket.off("friend_removed", syncRelationship);

      socket.off("user_blocked", syncRelationship);
      socket.off("user_blocked_by_other", syncRelationship);
      socket.off("user_unblocked", syncRelationship);

      socket.off("connect");

      socket.disconnect();
    };
  }, [userId, fetchProfile]);

  /*
    ============================================================
    MESSAGE
    ============================================================
  */

  const handleMessage = () => {
    if (!profile._id || !onMessage) {
      return;
    }

    if (relationshipStatus !== "friends") {
      return;
    }

    onMessage({
      _id: profile._id,
      username: profile.username,
      displayName: profile.displayName,
      profilePicture: profile.profilePicture,
      isFriend: true,
    });
  };

  /*
    ============================================================
    SEND FRIEND REQUEST
    ============================================================
  */

  const handleSendFriendRequest = async () => {
    if (
      !profile._id ||
      isFriendRequestLoading ||
      relationshipStatus !== "none"
    ) {
      return;
    }

    setIsFriendRequestLoading(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/request/${profile._id}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to send friend request.");
        return;
      }

      /*
        Immediate local update.
      */
      setRelationshipStatus("sent");

      /*
        The Socket.IO event will also synchronize this profile
        with the authoritative backend state.
      */
      fetchProfile(false);
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      setIsFriendRequestLoading(false);
    }
  };

  /*
    ============================================================
    ACCEPT FRIEND REQUEST
    ============================================================
  */

  const handleAcceptFriendRequest = async () => {
    if (
      !profile._id ||
      isFriendRequestLoading ||
      relationshipStatus !== "received"
    ) {
      return;
    }

    setIsFriendRequestLoading(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/accept/${profile._id}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to accept friend request.");
        return;
      }

      /*
        Immediate local update.
      */
      setRelationshipStatus("friends");

      /*
        Socket.IO also synchronizes every affected client.
      */
      fetchProfile(false);
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    } finally {
      setIsFriendRequestLoading(false);
    }
  };

  /*
    ============================================================
    UNFRIEND
    ============================================================
  */

  const handleUnfriendClick = () => {
    if (relationshipStatus !== "friends") {
      return;
    }

    setShowUnfriendModal(true);
  };

  const closeUnfriendModal = () => {
    if (isUnfriending) {
      return;
    }

    setShowUnfriendModal(false);
  };

  const confirmUnfriend = async () => {
    if (!profile._id || isUnfriending) {
      return;
    }

    setIsUnfriending(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/${profile._id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unfriend user.");
        return;
      }

      /*
        Immediately update this profile.

        No refresh required.
      */
      setRelationshipStatus("none");
      setShowUnfriendModal(false);

      /*
        Socket.IO friend_removed will synchronize the other
        connected client as well.
      */
      fetchProfile(false);
    } catch (error) {
      console.error("Failed to unfriend user:", error);
    } finally {
      setIsUnfriending(false);
    }
  };

  /*
    ============================================================
    BLOCK
    ============================================================
  */

  const handleBlockClick = () => {
    if (!profile._id || isBlocking) {
      return;
    }

    setShowBlockModal(true);
  };

  const closeBlockModal = () => {
    if (isBlocking) {
      return;
    }

    setShowBlockModal(false);
  };

  const confirmBlock = async () => {
    if (!profile._id || isBlocking) {
      return;
    }

    setIsBlocking(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/block/${profile._id}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to block user.");
        return;
      }

      /*
        Immediately update the public profile.
      */
      setRelationshipStatus("blocked");
      setShowBlockModal(false);

      /*
        Keep locally cached current user synchronized.
      */
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "null");

        if (storedUser) {
          const blockedId = String(profile._id);

          const existingBlocked = (storedUser.blockedUsers || [])
            .map((blockedUser) => blockedUser?._id || blockedUser)
            .map(String);

          const nextBlockedUsers = existingBlocked.includes(blockedId)
            ? existingBlocked
            : [...existingBlocked, blockedId];

          localStorage.setItem(
            "user",
            JSON.stringify({
              ...storedUser,
              blockedUsers: nextBlockedUsers,
            }),
          );
        }
      } catch (storageError) {
        console.error("Failed to synchronize local user state:", storageError);
      }

      /*
        Socket.IO will synchronize other connected clients.
      */
      fetchProfile(false);
    } catch (error) {
      console.error("Failed to block user:", error);
    } finally {
      setIsBlocking(false);
    }
  };

  /*
    ============================================================
    UNBLOCK
    ============================================================
  */

  const handleUnblock = async () => {
    if (!profile._id || isUnblocking) {
      return;
    }

    setIsUnblocking(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/block/${profile._id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to unblock user.");
        return;
      }

      /*
        Unblocking does NOT restore the friendship.
      */
      setRelationshipStatus("none");

      /*
        Keep localStorage synchronized immediately.
      */
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "null");

        if (storedUser) {
          const unblockedId = String(profile._id);

          const nextBlockedUsers = (storedUser.blockedUsers || [])
            .map((blockedUser) => blockedUser?._id || blockedUser)
            .map(String)
            .filter((id) => id !== unblockedId);

          localStorage.setItem(
            "user",
            JSON.stringify({
              ...storedUser,
              blockedUsers: nextBlockedUsers,
            }),
          );
        }
      } catch (storageError) {
        console.error("Failed to synchronize local user state:", storageError);
      }

      /*
        Socket.IO will synchronize other connected clients.
      */
      fetchProfile(false);
    } catch (error) {
      console.error("Failed to unblock user:", error);
    } finally {
      setIsUnblocking(false);
    }
  };

  /*
    ============================================================
    RELATIONSHIP ACTION
    ============================================================
  */

  const renderRelationshipAction = () => {
    if (relationshipStatus === "friends") {
      return (
        <div className="flex w-full flex-col items-start gap-3">
          {/* Friends status */}
          <div className="inline-flex items-center gap-2 rounded-full bg-chime-gold/20 px-3 py-2 text-xs font-bold text-chime-text">
            <UserCheck size={14} />
            Friends
          </div>

          {/* Friend actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleMessage}
              className="inline-flex items-center gap-2 rounded-lg bg-chime-gold px-4 py-2 text-sm font-bold text-chime-text shadow-sm transition hover:brightness-95 active:scale-[0.98]"
            >
              <MessageCircle size={16} />
              Message
            </button>

            <button
              type="button"
              onClick={handleUnfriendClick}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-chime-secondary transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <UserMinus size={14} />
              Unfriend
            </button>

            <button
              type="button"
              onClick={handleBlockClick}
              disabled={isBlocking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserRoundX size={14} />
              Block
            </button>
          </div>
        </div>
      );
    }

    if (relationshipStatus === "sent") {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled
            className="inline-flex cursor-default items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-chime-secondary"
          >
            <Clock3 size={16} />
            Request Sent
          </button>

          <button
            type="button"
            onClick={handleBlockClick}
            disabled={isBlocking}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserRoundX size={16} />
            Block
          </button>
        </div>
      );
    }

    if (relationshipStatus === "received") {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAcceptFriendRequest}
            disabled={isFriendRequestLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-chime-gold px-4 py-2 text-sm font-bold text-chime-text shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserCheck size={16} />
            {isFriendRequestLoading ? "Accepting..." : "Accept Request"}
          </button>

          <button
            type="button"
            onClick={handleBlockClick}
            disabled={isBlocking}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserRoundX size={16} />
            Block
          </button>
        </div>
      );
    }

    if (relationshipStatus === "blocked") {
      return (
        <button
          type="button"
          onClick={handleUnblock}
          disabled={isUnblocking}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserRoundCheck size={16} />
          {isUnblocking ? "Unblocking..." : "Unblock"}
        </button>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSendFriendRequest}
          disabled={isFriendRequestLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-chime-chat px-4 py-2 text-sm font-bold text-chime-text shadow-sm transition hover:border-chime-gold hover:bg-chime-gold/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus size={16} />
          {isFriendRequestLoading ? "Sending..." : "Add Friend"}
        </button>

        <button
          type="button"
          onClick={handleBlockClick}
          disabled={isBlocking}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserRoundX size={16} />
          Block
        </button>
      </div>
    );
  };

  /*
    ============================================================
    LOADING
    ============================================================
  */

  if (loading) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center bg-chime-background">
        <p className="text-sm text-chime-secondary">Loading profile...</p>
      </section>
    );
  }

  /*
    ============================================================
    ERROR
    ============================================================
  */

  if (error) {
    return (
      <section className="flex min-h-0 flex-1 flex-col bg-chime-background">
        <header className="flex h-16 shrink-0 items-center border-b border-stone-200 px-5 md:px-8">
          <button
            onClick={onBack}
            className="mr-3 rounded-lg p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-xl font-bold text-chime-text">Profile</h1>

            <p className="text-xs text-chime-secondary">Chime member</p>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <User size={26} />
            </div>

            <p className="mt-4 text-sm font-medium text-red-500">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  const displayName = profile.displayName || profile.username || "User";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-chime-background">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-stone-200 bg-chime-background px-5 md:px-8">
        <button
          onClick={onBack}
          className="mr-3 rounded-lg p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h1 className="text-xl font-bold text-chime-text">Profile</h1>

          <p className="text-xs text-chime-secondary">Chime member</p>
        </div>
      </header>

      {/* Profile */}
      <div className="min-h-0 flex-1">
        {/* Banner */}
        <div className="h-36 w-full bg-chime-gold md:h-44" />

        {/* Profile Body */}
        <div className="px-5 pb-12 md:px-10 lg:px-14">
          <div className="relative mx-auto max-w-5xl">
            {/* Avatar */}
            <div className="-mt-12 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-[6px] border-chime-background bg-chime-bright text-chime-text shadow-md md:-mt-14 md:h-32 md:w-32">
              {profile.profilePicture ? (
                <img
                  src={profile.profilePicture}
                  alt={`${displayName}'s profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User size={52} strokeWidth={1.8} />
              )}
            </div>

            {/* Identity */}
            <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="text-3xl font-extrabold tracking-tight text-chime-text md:text-4xl">
                  {displayName}
                </h2>

                <p className="mt-1 text-base font-medium text-chime-secondary md:text-lg">
                  @{profile.username}
                </p>

                {/* Actions */}
                <div className="mt-5 flex flex-wrap items-start gap-3">
                  {renderRelationshipAction()}
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
              {/* About */}
              <div className="rounded-2xl border border-stone-200 bg-chime-chat p-6 md:p-7">
                <h3 className="text-sm font-bold text-chime-text">About</h3>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-chime-text md:text-base">
                  {profile.bio || "No bio yet."}
                </p>
              </div>

              {/* Member Information */}
              <div className="rounded-2xl border border-stone-200 bg-chime-chat p-6 md:p-7">
                <h3 className="text-sm font-bold text-chime-text">
                  Member Information
                </h3>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-chime-secondary">
                    Username
                  </p>

                  <p className="mt-2 text-sm font-medium text-chime-text">
                    @{profile.username}
                  </p>
                </div>

                <div className="mt-6 border-t border-stone-200 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-chime-secondary">
                    Connection
                  </p>

                  <p className="mt-2 text-sm font-medium text-chime-text">
                    {relationshipStatus === "friends"
                      ? "Friends"
                      : relationshipStatus === "sent"
                        ? "Request Sent"
                        : relationshipStatus === "received"
                          ? "Request Received"
                          : relationshipStatus === "blocked"
                            ? "Blocked"
                            : "Not friends"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unfriend Confirmation */}
      <ConfirmModal
        isOpen={showUnfriendModal}
        title={`Unfriend ${displayName}?`}
        message="Your conversation and message history will remain available, but you won't be able to send new messages unless you become friends again."
        confirmText="Unfriend"
        cancelText="Cancel"
        onConfirm={confirmUnfriend}
        onCancel={closeUnfriendModal}
        loading={isUnfriending}
      />

      {/* Block Confirmation */}
      <ConfirmModal
        isOpen={showBlockModal}
        title={`Block ${displayName}?`}
        message="Blocking this user will remove the friendship and any pending friend requests. You will no longer be able to message each other."
        confirmText="Block"
        cancelText="Cancel"
        onConfirm={confirmBlock}
        onCancel={closeBlockModal}
        loading={isBlocking}
      />
    </section>
  );
}

export default PublicProfile;
