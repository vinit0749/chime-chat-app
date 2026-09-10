import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  UserMinus,
  XCircle,
  Users,
  MessageCircle,
  Search,
  UserPlus,
  Clock,
  UserRound,
} from "lucide-react";
import { authFetch } from "../../../shared/utils/authFetch";
import ConfirmModal from "../../../shared/components/ConfirmModal";

function FriendRequests({ onOpenProfile, onSelectChat, onBack }) {
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeSection, setActiveSection] = useState("friends");

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [friendToRemove, setFriendToRemove] = useState(null);
  const [isUnfriending, setIsUnfriending] = useState(false);

  const [friendToAdd, setFriendToAdd] = useState(null);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  const fetchData = async () => {
    try {
      const [requestsResponse, friendsResponse] = await Promise.all([
        authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/friends/requests`),
        authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/friends`),
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
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!search.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const response = await authFetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/users/search?q=${encodeURIComponent(
            search.trim(),
          )}`,
        );

        if (response.status === 401) {
          return;
        }

        const data = await response.json();

        if (response.ok) {
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error("User search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(searchUsers, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const isFriend = (userId) => {
    return friends.some((friend) => String(friend?._id) === String(userId));
  };

  const handleOpenProfile = (userId) => {
    if (!userId || !onOpenProfile) {
      return;
    }

    onOpenProfile(userId);
  };

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

  const handleMessageSearchUser = (person) => {
    if (!person?._id || !onSelectChat) {
      return;
    }

    onSelectChat({
      type: "dm",
      user: person,
      isFriend: isFriend(person._id),
    });

    setSearch("");
    setSearchResults([]);
  };

  const getRelationshipStatus = (person) => {
    if (person.relationshipStatus) {
      return person.relationshipStatus;
    }

    if (isFriend(person._id)) {
      return "friends";
    }

    return null;
  };

  const handleAddFriendClick = (person) => {
    if (!person?._id) {
      return;
    }

    setFriendToAdd(person);
  };

  const confirmAddFriend = async () => {
    if (!friendToAdd?._id || isSendingRequest) {
      return;
    }

    setIsSendingRequest(true);

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/friends/request/${friendToAdd._id}`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to send friend request.");
        return;
      }

      setSearchResults((currentResults) =>
        currentResults.map((person) =>
          String(person?._id) === String(friendToAdd._id)
            ? {
                ...person,
                relationshipStatus: "sent",
              }
            : person,
        ),
      );

      setFriendToAdd(null);
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const acceptRequest = async (userId) => {
    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/friends/accept/${userId}`,
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

  const rejectRequest = async (userId) => {
    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/friends/reject/${userId}`,
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

  const handleUnfriendClick = (friend) => {
    setFriendToRemove(friend);
  };

  const closeUnfriendModal = () => {
    if (isUnfriending) {
      return;
    }

    setFriendToRemove(null);
  };

  const confirmUnfriend = async () => {
    if (!friendToRemove) {
      return;
    }

    setIsUnfriending(true);

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/friends/${friendToRemove._id}`,
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

  const renderRelationshipButton = (person) => {
    const relationshipStatus = getRelationshipStatus(person);

    if (relationshipStatus === "friends") {
      return (
        <button
          type="button"
          disabled
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title="Already friends"
        >
          <Check size={16} />
        </button>
      );
    }

    if (relationshipStatus === "sent" || relationshipStatus === "received") {
      return (
        <button
          type="button"
          disabled
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title={
            relationshipStatus === "sent"
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
        onClick={() => handleAddFriendClick(person)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-chime-text transition hover:bg-chime-gold"
        title="Add friend"
        aria-label={`Add ${person.displayName || person.username} as a friend`}
      >
        <UserPlus size={16} />
      </button>
    );
  };

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-chime-chat">
      <header className="flex min-h-16 shrink-0 items-center border-b border-stone-200 bg-chime-background px-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0">
          <h2 className="text-base font-bold text-chime-text sm:text-lg">
            Friends
          </h2>

          <p className="mt-0.5 text-xs text-chime-secondary sm:text-sm">
            Manage your friends and connections
          </p>
        </div>
      </header>

      <div className="chime-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <p className="text-sm text-chime-secondary">
                Loading connections...
              </p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl">
              <section className="rounded-2xl border border-stone-200 bg-chime-background p-4 shadow-sm sm:p-5">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chime-gold">
                      <UserPlus size={16} className="text-chime-text" />
                    </div>

                    <div>
                      <h3 className="font-bold text-chime-text">Find People</h3>

                      <p className="text-xs text-chime-secondary">
                        Search by username or display name
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex h-11 items-center rounded-xl border border-stone-200 bg-chime-chat px-3 transition focus-within:border-chime-gold">
                    <Search
                      size={17}
                      className="shrink-0 text-chime-secondary"
                    />

                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search people..."
                      className="min-w-0 flex-1 bg-transparent px-2.5 text-sm text-chime-text outline-none placeholder:text-chime-secondary"
                    />
                  </div>

                  {search.trim() && (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-stone-200 bg-chime-background shadow-xl">
                      {isSearching ? (
                        <div className="px-4 py-4 text-sm text-chime-secondary">
                          Searching...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-chime-secondary">
                          No users found
                        </div>
                      ) : (
                        <div className="chime-scrollbar max-h-80 overflow-y-auto">
                          {searchResults.map((person) => (
                            <div
                              key={person._id}
                              className="flex items-center gap-3 px-3 py-3 transition hover:bg-chime-selected"
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenProfile(person._id)}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                title="View profile"
                              >
                                {person.profilePicture ? (
                                  <img
                                    src={person.profilePicture}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-10 w-10 shrink-0 rounded-full bg-chime-gold" />
                                )}

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-chime-text">
                                    {person.displayName ||
                                      `@${person.username}`}
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
                                  handleMessageSearchUser(person);
                                }}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-gold hover:text-chime-text"
                                title="Message"
                                aria-label="Message user"
                              >
                                <MessageCircle size={16} />
                              </button>

                              {renderRelationshipButton(person)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <div className="mt-6 rounded-xl border border-stone-200 bg-chime-background p-1.5 shadow-sm">
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setActiveSection("friends")}
                    className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      activeSection === "friends"
                        ? "bg-chime-selected text-chime-text shadow-sm"
                        : "text-chime-secondary hover:bg-chime-selected/60 hover:text-chime-text"
                    }`}
                  >
                    <Users size={16} />
                    Friends
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        activeSection === "friends"
                          ? "bg-chime-gold text-chime-text"
                          : "bg-stone-100 text-chime-secondary"
                      }`}
                    >
                      {friends.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("requests")}
                    className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      activeSection === "requests"
                        ? "bg-chime-selected text-chime-text shadow-sm"
                        : "text-chime-secondary hover:bg-chime-selected/60 hover:text-chime-text"
                    }`}
                  >
                    <Clock size={16} />
                    Requests
                    {requests.length > 0 && (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-chime-gold px-1.5 py-0.5 text-[11px] font-bold text-chime-text">
                        {requests.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {activeSection === "friends" ? (
                <section className="mt-6">
                  <div className="mb-4">
                    <h3 className="font-bold text-chime-text">Your Friends</h3>

                    <p className="mt-1 text-sm text-chime-secondary">
                      People you're connected with.
                    </p>
                  </div>

                  {friends.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-chime-background px-5 py-12">
                      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chime-gold">
                          <Users size={21} className="text-chime-text" />
                        </div>

                        <p className="mt-4 font-semibold text-chime-text">
                          No friends yet
                        </p>

                        <p className="mt-1.5 text-sm leading-5 text-chime-secondary">
                          Search for someone above and send them a friend
                          request to start connecting.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-chime-background">
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

                          <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                            <button
                              type="button"
                              onClick={() => handleMessageFriend(friend)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-chime-secondary transition hover:bg-chime-gold hover:text-chime-text sm:h-auto sm:w-auto sm:flex-none sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
                              title={`Message ${
                                friend.displayName || `@${friend.username}`
                              }`}
                              aria-label={`Message ${
                                friend.displayName || `@${friend.username}`
                              }`}
                            >
                              <MessageCircle size={16} />
                              <span className="hidden sm:inline">Message</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUnfriendClick(friend)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-chime-secondary transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:h-auto sm:w-auto sm:flex-none sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
                              title="Unfriend"
                              aria-label={`Unfriend ${
                                friend.displayName || `@${friend.username}`
                              }`}
                            >
                              <UserMinus size={16} />
                              <span className="hidden sm:inline">Unfriend</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <section className="mt-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-chime-text">
                        Incoming Requests
                      </h3>

                      {requests.length > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chime-gold px-1.5 text-[11px] font-bold text-chime-text">
                          {requests.length}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-chime-secondary">
                      People who want to connect with you.
                    </p>
                  </div>

                  {requests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-chime-background px-5 py-12">
                      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chime-selected">
                          <Clock size={21} className="text-chime-secondary" />
                        </div>

                        <p className="mt-4 font-semibold text-chime-text">
                          No pending requests
                        </p>

                        <p className="mt-1.5 text-sm leading-5 text-chime-secondary">
                          When someone sends you a friend request, you'll find
                          it here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-chime-background">
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
                              type="button"
                              onClick={() => acceptRequest(request._id)}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-chime-gold px-4 py-2 text-sm font-semibold text-chime-text transition hover:bg-chime-bright sm:flex-none"
                            >
                              <Check size={16} />
                              Accept
                            </button>

                            <button
                              type="button"
                              onClick={() => rejectRequest(request._id)}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text sm:flex-none"
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
              )}
            </div>
          )}
        </div>
      </div>

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

      <ConfirmModal
        isOpen={Boolean(friendToAdd)}
        title="Send friend request?"
        message={`Send a friend request to ${
          friendToAdd?.displayName || `@${friendToAdd?.username || "this user"}`
        }?`}
        confirmText="Send Request"
        cancelText="Cancel"
        onConfirm={confirmAddFriend}
        onCancel={() => {
          if (!isSendingRequest) {
            setFriendToAdd(null);
          }
        }}
        loading={isSendingRequest}
      />
    </main>
  );
}

export default FriendRequests;
