import { useEffect, useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  User,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import ConfirmModal from "./ConfirmModal";

function PublicProfile({ userId, onBack, onMessage }) {
  const [profile, setProfile] = useState({
    _id: "",
    username: "",
    displayName: "",
    bio: "",
    profilePicture: "",
  });

  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [isUnfriending, setIsUnfriending] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
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

        setIsFriend(Boolean(data.user.isFriend));
      } catch (error) {
        console.error("Failed to load public profile:", error);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  /*
    Open a DM with this user.
  */
  const handleMessage = () => {
    if (!profile._id || !onMessage) {
      return;
    }

    onMessage({
      _id: profile._id,
      username: profile.username,
      displayName: profile.displayName,
      profilePicture: profile.profilePicture,
      isFriend,
    });
  };

  /*
    Open unfriend confirmation.
  */
  const handleUnfriendClick = () => {
    setShowUnfriendModal(true);
  };

  /*
    Close unfriend confirmation.
  */
  const closeUnfriendModal = () => {
    if (isUnfriending) {
      return;
    }

    setShowUnfriendModal(false);
  };

  /*
    Confirm unfriend.
  */
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
        console.error(data.message);
        return;
      }

      setIsFriend(false);
      setShowUnfriendModal(false);
    } catch (error) {
      console.error("Failed to unfriend user:", error);
    } finally {
      setIsUnfriending(false);
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center bg-chime-background">
        <p className="text-sm text-chime-secondary">Loading profile...</p>
      </section>
    );
  }

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
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {/* Message */}
                  <button
                    type="button"
                    onClick={handleMessage}
                    className="inline-flex items-center gap-2 rounded-lg bg-chime-gold px-4 py-2 text-sm font-bold text-chime-text shadow-sm transition hover:brightness-95 active:scale-[0.98]"
                  >
                    <MessageCircle size={16} />
                    Message
                  </button>

                  {/* Friendship Status */}
                  {isFriend && (
                    <>
                      <div className="inline-flex items-center gap-2 rounded-full bg-chime-gold/20 px-3 py-2 text-xs font-bold text-chime-text">
                        <UserCheck size={14} />
                        Friends
                      </div>

                      <button
                        type="button"
                        onClick={handleUnfriendClick}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-chime-secondary transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <UserMinus size={14} />
                        Unfriend
                      </button>
                    </>
                  )}
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
                    {isFriend ? "Friends" : "Not friends"}
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
    </section>
  );
}

export default PublicProfile;
