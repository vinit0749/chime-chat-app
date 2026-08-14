import { useEffect, useState } from "react";
import { Check, UserMinus, XCircle, Users, MessageCircle } from "lucide-react";
import { authFetch } from "../utils/authFetch";
import ConfirmModal from "./ConfirmModal";

function FriendRequests({ onOpenProfile, onSelectChat }) {
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [friendToRemove, setFriendToRemove] = useState(null);
  const [isUnfriending, setIsUnfriending] = useState(false);

  const fetchData = async () => {
    try {
      const [requestsResponse, friendsResponse] = await Promise.all([
        authFetch("http://localhost:5000/api/friends/requests"),
        authFetch("http://localhost:5000/api/friends"),
      ]);

      const requestsData = await requestsResponse.json();
      const friendsData = await friendsResponse.json();

      if (requestsResponse.ok) {
        setRequests(requestsData.requests || []);
      }

      if (friendsResponse.ok) {
        setFriends(friendsData.friends || []);
      }
    } catch (error) {
      console.error("Failed to load friend data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, []);

  /*
    Open a user's public profile.
  */
  const handleOpenProfile = (userId) => {
    if (!userId || !onOpenProfile) {
      return;
    }

    onOpenProfile(userId);
  };

  /*
    Open a DM with a friend.
  */
  const handleMessageFriend = (friend) => {
    if (!friend?._id || !onSelectChat) {
      return;
    }

    onSelectChat({
      type: "dm",
      user: friend,
      isFriend: true,
    });
  };

  /*
    Accept friend request
  */
  const acceptRequest = async (userId) => {
    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/accept/${userId}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message);
        return;
      }

      await fetchData();
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    }
  };

  /*
    Reject friend request
  */
  const rejectRequest = async (userId) => {
    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/reject/${userId}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message);
        return;
      }

      await fetchData();
    } catch (error) {
      console.error("Failed to reject friend request:", error);
    }
  };

  /*
    Open unfriend confirmation modal
  */
  const handleUnfriendClick = (friend) => {
    setFriendToRemove(friend);
  };

  /*
    Close unfriend confirmation modal
  */
  const closeUnfriendModal = () => {
    if (isUnfriending) {
      return;
    }

    setFriendToRemove(null);
  };

  /*
    Confirm unfriend
  */
  const confirmUnfriend = async () => {
    if (!friendToRemove) {
      return;
    }

    setIsUnfriending(true);

    try {
      const response = await authFetch(
        `http://localhost:5000/api/friends/${friendToRemove._id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message);
        return;
      }

      setFriendToRemove(null);

      await fetchData();
    } catch (error) {
      console.error("Failed to unfriend user:", error);
    } finally {
      setIsUnfriending(false);
    }
  };

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
      {/* Header */}
      <header className="flex min-h-16 shrink-0 items-center border-b border-stone-200 bg-chime-background px-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-chime-text sm:text-lg">
            Friends
          </h2>

          <p className="mt-0.5 text-xs text-chime-secondary sm:text-sm">
            Manage your friends and connections
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full p-4 sm:p-6 lg:p-8">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <p className="text-sm text-chime-secondary">
                Loading connections...
              </p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl">
              {/* Incoming Requests */}
              <section>
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-chime-text">
                      Incoming Requests
                    </h3>

                    {requests.length > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chime-gold px-1.5 text-xs font-bold text-chime-text">
                        {requests.length}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-chime-secondary">
                    People who want to connect with you.
                  </p>
                </div>

                {requests.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 bg-chime-background px-4 py-5 sm:px-5">
                    <p className="text-sm text-chime-secondary">
                      You have no pending friend requests.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-stone-200 bg-chime-background">
                    {requests.map((request, index) => (
                      <div
                        key={request._id}
                        className={`flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${
                          index !== requests.length - 1
                            ? "border-b border-stone-200"
                            : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {/* Requester PFP */}
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(request._id)}
                            className="h-10 w-10 shrink-0 overflow-hidden rounded-full transition hover:opacity-80"
                            aria-label={`View ${
                              request.displayName || request.username
                            }'s profile`}
                          >
                            {request.profilePicture ? (
                              <img
                                src={request.profilePicture}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-chime-bright" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenProfile(request._id)}
                            className="min-w-0 text-left"
                          >
                            <p className="truncate font-semibold text-chime-text hover:underline">
                              {request.displayName || request.username}
                            </p>

                            <p className="mt-0.5 text-sm text-chime-secondary">
                              @{request.username}
                            </p>
                          </button>
                        </div>

                        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                          <button
                            onClick={() => acceptRequest(request._id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-chime-gold px-3 py-2 text-sm font-semibold text-chime-text transition hover:bg-chime-bright sm:flex-none"
                          >
                            <Check size={16} />
                            Accept
                          </button>

                          <button
                            onClick={() => rejectRequest(request._id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text sm:flex-none"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Friends */}
              <section className="mt-8">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-chime-text">Your Friends</h3>

                    {friends.length > 0 && (
                      <span className="text-xs font-semibold text-chime-secondary">
                        {friends.length}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-chime-secondary">
                    Manage the people you're connected with.
                  </p>
                </div>

                {friends.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 bg-chime-background px-4 py-5 sm:px-5">
                    <p className="text-sm text-chime-secondary">
                      You don't have any friends yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-stone-200 bg-chime-background">
                    {friends.map((friend, index) => (
                      <div
                        key={friend._id}
                        className={`flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${
                          index !== friends.length - 1
                            ? "border-b border-stone-200"
                            : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {/* Friend PFP */}
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(friend._id)}
                            className="relative h-10 w-10 shrink-0 rounded-full transition hover:opacity-80"
                            aria-label={`View ${
                              friend.displayName || friend.username
                            }'s profile`}
                          >
                            {friend.profilePicture ? (
                              <img
                                src={friend.profilePicture}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-chime-gold" />
                            )}

                            {/* Online indicator */}
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-chime-background bg-green-500" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenProfile(friend._id)}
                            className="min-w-0 text-left"
                          >
                            <p className="truncate font-semibold text-chime-text hover:underline">
                              {friend.displayName || friend.username}
                            </p>

                            <p className="mt-0.5 text-sm text-chime-secondary">
                              @{friend.username}
                            </p>
                          </button>
                        </div>

                        {/* Friend Actions */}
                        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleMessageFriend(friend)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-chime-secondary transition hover:bg-chime-gold hover:text-chime-text sm:flex-none"
                            title={`Message ${
                              friend.displayName || `@${friend.username}`
                            }`}
                          >
                            <MessageCircle size={16} />
                            Message
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUnfriendClick(friend)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-chime-secondary transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:flex-none"
                          >
                            <UserMinus size={16} />
                            Unfriend
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Completely empty state */}
              {requests.length === 0 && friends.length === 0 && (
                <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-chime-background px-5 py-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chime-gold">
                      <Users size={20} className="text-chime-text" />
                    </div>

                    <p className="mt-3 font-semibold text-chime-text">
                      No connections yet
                    </p>

                    <p className="mt-1 max-w-sm text-sm leading-5 text-chime-secondary">
                      Search for people in the sidebar and send them a friend
                      request to get started.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unfriend Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(friendToRemove)}
        title={`Unfriend ${friendToRemove?.username || "this user"}?`}
        message="Your conversation and message history will remain available, but you won't be able to send new messages unless you become friends again."
        confirmText="Unfriend"
        cancelText="Cancel"
        onConfirm={confirmUnfriend}
        onCancel={closeUnfriendModal}
        loading={isUnfriending}
      />
    </main>
  );
}

export default FriendRequests;
