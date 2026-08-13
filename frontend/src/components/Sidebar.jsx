import { useEffect, useRef, useState } from "react";
import { X, Search, UserPlus, Check, Clock, LogOut, Users } from "lucide-react";
import { authFetch } from "../utils/authFetch";
import ConfirmModal from "./ConfirmModal";

function Sidebar({
  mobile = false,
  onClose,
  onSelectChat,
  onOpenFriendRequests,
  activeView,
}) {
  const user = JSON.parse(localStorage.getItem("user"));

  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [isSearching, setIsSearching] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [modal, setModal] = useState({
    isOpen: false,
    type: null,
    user: null,
  });

  const [isModalLoading, setIsModalLoading] = useState(false);

  const searchRef = useRef(null);

  /*
    Fetch friends
  */
  const fetchFriends = async () => {
    try {
      const response = await authFetch("http://localhost:5000/api/friends");

      if (response.status === 401) {
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
    }
  };

  /*
    Fetch existing DM conversations.

    Conversations are intentionally separate from friends.

    A conversation remains visible even after
    the friendship is removed.
  */
  const fetchConversations = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/messages/dms",
      );

      if (response.status === 401) {
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  };

  /*
    Fetch friend requests
  */
  const fetchRequests = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/friends/requests",
      );

      if (response.status === 401) {
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Failed to load friend requests:", error);
    }
  };

  /*
    Initial load + lightweight polling
  */
  useEffect(() => {
    fetchFriends();
    fetchConversations();
    fetchRequests();

    const interval = setInterval(() => {
      fetchFriends();
      fetchConversations();
      fetchRequests();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  /*
    Close search when clicking outside or pressing Escape
  */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearch("");
        setSearchResults([]);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSearch("");
        setSearchResults([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  /*
    Search users
  */
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
          `http://localhost:5000/api/users/search?q=${encodeURIComponent(
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

  /*
    Open confirmation modal for sending a friend request.
  */
  const openSendRequestModal = (person) => {
    setModal({
      isOpen: true,
      type: "sendRequest",
      user: person,
    });
  };

  /*
    Open confirmation modal for removing a friend.
  */
  const openUnfriendModal = (friend) => {
    setModal({
      isOpen: true,
      type: "unfriend",
      user: friend,
    });
  };

  /*
    Open confirmation modal for logout.
  */
  const handleLogout = () => {
    setModal({
      isOpen: true,
      type: "logout",
      user: null,
    });
  };

  /*
    Close confirmation modal.
  */
  const closeModal = () => {
    if (isModalLoading) {
      return;
    }

    setModal({
      isOpen: false,
      type: null,
      user: null,
    });
  };

  /*
    Confirm modal action.
  */
  const handleConfirmModal = async () => {
    if (modal.type !== "logout" && !modal.user) {
      return;
    }

    setIsModalLoading(true);

    try {
      if (modal.type === "logout") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/login";
        return;
      }

      if (modal.type === "sendRequest") {
        const response = await authFetch(
          `http://localhost:5000/api/friends/request/${modal.user._id}`,
          {
            method: "POST",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message);
          return;
        }

        setSearch("");
        setSearchResults([]);

        await fetchRequests();
      }

      if (modal.type === "unfriend") {
        const response = await authFetch(
          `http://localhost:5000/api/friends/${modal.user._id}`,
          {
            method: "DELETE",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(data.message);
          return;
        }

        await fetchFriends();
      }

      setModal({
        isOpen: false,
        type: null,
        user: null,
      });
    } catch (error) {
      if (modal.type === "sendRequest") {
        console.error("Failed to send friend request:", error);
      }

      if (modal.type === "unfriend") {
        console.error("Failed to unfriend user:", error);
      }
    } finally {
      setIsModalLoading(false);
    }
  };

  /*
    Check whether a conversation user is currently a friend.
  */
  const isFriend = (userId) => {
    return friends.some((friend) => friend._id === userId);
  };

  /*
    Find an existing DM conversation for a user.
  */
  const findConversation = (userId) => {
    return conversations.find((conversation) => conversation._id === userId);
  };

  /*
    Select DM conversation.
  */
  const handleSelectConversation = (conversation) => {
    onSelectChat({
      type: "dm",
      user: conversation,
      isFriend: isFriend(conversation._id),
    });

    if (mobile && onClose) {
      onClose();
    }
  };

  /*
    Select General.
  */
  const handleSelectGeneral = () => {
    onSelectChat({
      type: "room",
      room: "general",
      name: "General",
    });

    if (mobile && onClose) {
      onClose();
    }
  };

  /*
    Open Friends.
  */
  const handleOpenFriends = () => {
    onOpenFriendRequests();

    if (mobile && onClose) {
      onClose();
    }
  };

  /*
    Search relationship button.
  */
  const renderRelationshipButton = (person) => {
    if (person.relationshipStatus === "friends") {
      return (
        <button
          disabled
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title="Already friends"
        >
          <Check size={16} />
        </button>
      );
    }

    if (
      person.relationshipStatus === "sent" ||
      person.relationshipStatus === "received"
    ) {
      return (
        <button
          disabled
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
          title={
            person.relationshipStatus === "sent"
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
        onClick={() => openSendRequestModal(person)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-chime-text transition hover:bg-chime-gold"
        title="Add friend"
      >
        <UserPlus size={16} />
      </button>
    );
  };

  return (
    <>
      <aside
        className={`h-screen w-72 shrink-0 flex-col border-r border-stone-200 bg-chime-background ${
          mobile ? "flex" : "hidden md:flex"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-5">
          <h1 className="text-2xl font-bold text-chime-text">Chime 🔔</h1>

          {mobile && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-chime-text transition hover:bg-chime-selected"
              aria-label="Close sidebar"
            >
              <X size={22} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {/* Search */}
          <div ref={searchRef} className="relative mb-6">
            <div className="flex items-center rounded-xl border border-stone-200 bg-chime-chat px-3">
              <Search size={17} className="shrink-0 text-chime-secondary" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find people..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-chime-text outline-none placeholder:text-chime-secondary"
              />
            </div>

            {search.trim() && (
              <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-xl border border-stone-200 bg-chime-background shadow-lg">
                {isSearching ? (
                  <p className="px-4 py-3 text-sm text-chime-secondary">
                    Searching...
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-chime-secondary">
                    No users found
                  </p>
                ) : (
                  searchResults.map((person) => {
                    const conversation = findConversation(person._id);

                    return (
                      <div
                        key={person._id}
                        className="flex items-center gap-3 px-3 py-3 transition hover:bg-chime-selected"
                      >
                        <button
                          onClick={() => {
                            if (!conversation) {
                              return;
                            }

                            handleSelectConversation(conversation);
                            setSearch("");
                            setSearchResults([]);
                          }}
                          disabled={!conversation}
                          className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
                            conversation ? "cursor-pointer" : "cursor-default"
                          }`}
                        >
                          <div className="h-9 w-9 shrink-0 rounded-full bg-chime-gold" />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-chime-text">
                              {person.username}
                            </p>
                          </div>
                        </button>

                        {renderRelationshipButton(person)}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Direct Messages */}
          <div>
            <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-chime-secondary">
              Direct Messages
            </h2>

            {loadingConversations ? (
              <p className="px-2 py-2 text-sm text-chime-secondary">
                Loading...
              </p>
            ) : conversations.length === 0 ? (
              <p className="px-2 py-2 text-sm leading-5 text-chime-secondary">
                No conversations yet.
                <br />
                Search for someone above to get started.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => {
                  const friend = isFriend(conversation._id);

                  return (
                    <button
                      key={conversation._id}
                      onClick={() => handleSelectConversation(conversation)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition hover:bg-chime-selected"
                    >
                      <div className="relative h-8 w-8 shrink-0 rounded-full bg-chime-gold">
                        {friend && (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-chime-background bg-green-500" />
                        )}
                      </div>

                      <span className="min-w-0 flex-1 truncate">
                        {conversation.username}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Public Rooms */}
          <div className="mt-6">
            <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-chime-secondary">
              Public Rooms
            </h2>

            <button
              onClick={handleSelectGeneral}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition hover:bg-chime-selected"
            >
              <span className="text-lg text-chime-secondary">#</span>

              <span className="truncate">General</span>
            </button>
          </div>

          {/* Friends */}
          <div className="mt-auto border-t border-stone-200 pt-4">
            <button
              onClick={handleOpenFriends}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                activeView === "friendRequests"
                  ? "bg-chime-selected text-chime-text"
                  : "text-chime-text hover:bg-chime-selected"
              }`}
            >
              <Users
                size={18}
                className={
                  activeView === "friendRequests"
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
        </nav>

        {/* Profile */}
        <div className="shrink-0 border-t border-stone-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-chime-gold" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-chime-text">
                {user?.username || "User"}
              </p>

              <p className="text-xs text-chime-secondary">Online</p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modal.isOpen}
        title={
          modal.type === "sendRequest"
            ? "Send friend request?"
            : modal.type === "unfriend"
              ? "Remove friend?"
              : "Log out?"
        }
        message={
          modal.type === "sendRequest"
            ? `Send a friend request to ${modal.user?.username}?`
            : modal.type === "unfriend"
              ? `Are you sure you want to remove ${modal.user?.username} from your friends? Your existing conversation will remain available.`
              : "Are you sure you want to log out?"
        }
        confirmText={
          modal.type === "sendRequest"
            ? "Send Request"
            : modal.type === "unfriend"
              ? "Unfriend"
              : "Log Out"
        }
        cancelText="Cancel"
        onConfirm={handleConfirmModal}
        onCancel={closeModal}
        loading={isModalLoading}
      />
    </>
  );
}

export default Sidebar;
