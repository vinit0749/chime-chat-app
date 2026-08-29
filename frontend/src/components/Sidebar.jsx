import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  X,
  Search,
  UserPlus,
  Check,
  Clock,
  LogOut,
  Users,
  MessageCircle,
  Compass,
  Plus,
} from "lucide-react";
import { authFetch } from "../utils/authFetch";
import ConfirmModal from "./ConfirmModal";
import CreateClusterModal from "./CreateClusterModal";

function Sidebar({
  mobile = false,
  onClose,
  onSelectChat,
  onSelectCluster,
  onOpenDiscover,
  onOpenFriendRequests,
  onOpenProfile,
  onOpenUserProfile,
  activeView,
}) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [presence, setPresence] = useState({});

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(true);

  const [modal, setModal] = useState({
    isOpen: false,
    type: null,
    user: null,
  });

  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isCreateClusterModalOpen, setIsCreateClusterModalOpen] =
    useState(false);

  const searchRef = useRef(null);

  const fetchCurrentUser = async () => {
    try {
      const response = await authFetch("http://localhost:5000/api/users/me");

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);

        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...storedUser,
            ...data.user,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await authFetch("http://localhost:5000/api/friends");

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/messages/dms",
      );

      if (response.status === 401) return;

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

  const fetchRequests = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/friends/requests",
      );

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Failed to load friend requests:", error);
    }
  };

  const fetchClusters = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/clusters/mine",
      );

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setClusters(data.clusters || []);
      }
    } catch (error) {
      console.error("Failed to load Clusters:", error);
    } finally {
      setLoadingClusters(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchFriends();
    fetchConversations();
    fetchRequests();
    fetchClusters();

    const interval = setInterval(() => {
      fetchCurrentUser();
      fetchFriends();
      fetchConversations();
      fetchRequests();
      fetchClusters();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: {
        token,
      },
    });

    socket.on("presence_update", (data) => {
      if (!data?.userId) return;

      setPresence((currentPresence) => ({
        ...currentPresence,
        [data.userId]: data.status,
      }));
    });

    socket.on("presence_initial", (users) => {
      if (!Array.isArray(users)) return;

      const initialPresence = {};

      users.forEach((item) => {
        if (item?.userId) {
          initialPresence[item.userId] = item.status;
        }
      });

      setPresence(initialPresence);
    });

    socket.on("cluster_created", fetchClusters);
    socket.on("cluster_joined", fetchClusters);
    socket.on("cluster_left", fetchClusters);
    socket.on("cluster_membership_updated", fetchClusters);
    socket.on("cluster_membership_changed", fetchClusters);

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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

        if (response.status === 401) return;

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

  const openSendRequestModal = (person) => {
    setModal({
      isOpen: true,
      type: "sendRequest",
      user: person,
    });
  };

  const handleLogout = () => {
    setModal({
      isOpen: true,
      type: "logout",
      user: null,
    });
  };

  const closeModal = () => {
    if (isModalLoading) return;

    setModal({
      isOpen: false,
      type: null,
      user: null,
    });
  };

  const handleConfirmModal = async () => {
    if (modal.type !== "logout" && !modal.user) return;

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

      setModal({
        isOpen: false,
        type: null,
        user: null,
      });
    } catch (error) {
      if (modal.type === "sendRequest") {
        console.error("Failed to send friend request:", error);
      }
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleCreateCluster = async (cluster) => {
    setIsCreateClusterModalOpen(false);

    setClusters((currentClusters) => {
      const exists = currentClusters.some(
        (item) => String(item._id) === String(cluster?._id),
      );

      if (exists) {
        return currentClusters;
      }

      return [...currentClusters, cluster];
    });

    await fetchClusters();

    if (cluster?._id && onSelectCluster) {
      onSelectCluster(cluster);
    }
  };

  const isFriend = (userId) => {
    return friends.some((friend) => String(friend._id) === String(userId));
  };

  const findConversation = (userId) => {
    return conversations.find(
      (conversation) => String(conversation._id) === String(userId),
    );
  };

  const getUserStatus = (userId) => {
    return presence[userId] || "offline";
  };

  const getClusterInitial = (cluster) => {
    if (!cluster) {
      return "C";
    }

    return cluster.name?.trim()?.charAt(0)?.toUpperCase() || "C";
  };

  const publicClusters = clusters.filter(
    (cluster) => cluster.visibility === "public",
  );

  const privateClusters = clusters.filter(
    (cluster) => cluster.visibility === "private",
  );

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

  const handleOpenSearchProfile = (person) => {
    if (!person?._id || !onOpenUserProfile) return;

    onOpenUserProfile(person._id);

    setSearch("");
    setSearchResults([]);

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleMessageSearchUser = (person) => {
    if (!person?._id) return;

    const conversation = findConversation(person._id);
    const chatUser = conversation || person;

    onSelectChat({
      type: "dm",
      user: chatUser,
      isFriend: isFriend(person._id),
    });

    setSearch("");
    setSearchResults([]);

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleDiscoverClusters = () => {
    if (!onOpenDiscover) return;

    onOpenDiscover();

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleSelectCluster = (cluster) => {
    if (!cluster?._id || !onSelectCluster) {
      return;
    }

    onSelectCluster(cluster);

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleOpenFriends = () => {
    onOpenFriendRequests();

    if (mobile && onClose) {
      onClose();
    }
  };

  const handleOpenProfile = () => {
    onOpenProfile();

    if (mobile && onClose) {
      onClose();
    }
  };

  const renderRelationshipButton = (person) => {
    if (person.relationshipStatus === "friends") {
      return (
        <button
          type="button"
          disabled
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
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
          type="button"
          disabled
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-secondary"
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
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openSendRequestModal(person);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-chime-text transition hover:bg-chime-gold"
        title="Add friend"
      >
        <UserPlus size={16} />
      </button>
    );
  };

  const renderPresenceIndicator = (userId) => {
    const status = getUserStatus(userId);

    if (status === "online") {
      return (
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-chime-background bg-green-500"
          title="Online"
        />
      );
    }

    if (status === "away") {
      return (
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-chime-background bg-yellow-400"
          title="Away"
        />
      );
    }

    return null;
  };

  return (
    <>
      <aside
        className={`h-screen w-72 shrink-0 flex-col border-r border-stone-200 bg-chime-background ${
          mobile ? "flex" : "hidden md:flex"
        }`}
      >
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

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
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
                  searchResults.map((person) => (
                    <div
                      key={person._id}
                      className="flex items-center gap-2 px-3 py-3 transition hover:bg-chime-selected"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenSearchProfile(person)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        title="View profile"
                      >
                        <div className="relative h-9 w-9 shrink-0">
                          {person.profilePicture ? (
                            <img
                              src={person.profilePicture}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-chime-gold" />
                          )}

                          {renderPresenceIndicator(person._id)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-chime-text hover:underline">
                            {person.displayName || `@${person.username}`}
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
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-gold hover:text-chime-text"
                        title={`Message ${
                          person.displayName || `@${person.username}`
                        }`}
                        aria-label={`Message ${
                          person.displayName || person.username
                        }`}
                      >
                        <MessageCircle size={16} />
                      </button>

                      {renderRelationshipButton(person)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

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
                {conversations.map((conversation) => (
                  <button
                    key={conversation._id}
                    onClick={() => handleSelectConversation(conversation)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition hover:bg-chime-selected"
                  >
                    <div className="relative h-10 w-10 shrink-0">
                      {conversation.profilePicture ? (
                        <img
                          src={conversation.profilePicture}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-chime-gold" />
                      )}

                      {renderPresenceIndicator(conversation._id)}
                    </div>

                    <span className="min-w-0 flex-1 truncate">
                      {conversation.displayName || `@${conversation.username}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-chime-secondary">
                Clusters
              </h2>

              <button
                type="button"
                onClick={() => setIsCreateClusterModalOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
                title="Create or join a Cluster"
                aria-label="Create or join a Cluster"
              >
                <Plus size={16} />
              </button>
            </div>

            {loadingClusters ? (
              <p className="px-2 py-2 text-sm text-chime-secondary">
                Loading...
              </p>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-chime-secondary">
                    Public
                  </h3>

                  {publicClusters.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-chime-secondary">
                      No public Clusters joined.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {publicClusters.map((cluster) => (
                        <button
                          key={cluster._id}
                          type="button"
                          onClick={() => handleSelectCluster(cluster)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition ${
                            activeView === `cluster-${cluster._id}`
                              ? "bg-chime-selected"
                              : "hover:bg-chime-selected"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-gold text-sm font-bold text-chime-text">
                            {getClusterInitial(cluster)}
                          </div>

                          <span className="min-w-0 flex-1 truncate">
                            {cluster.name || "Unnamed Cluster"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-chime-secondary">
                    Private
                  </h3>

                  {privateClusters.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-chime-secondary">
                      No private Clusters joined.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {privateClusters.map((cluster) => (
                        <button
                          key={cluster._id}
                          type="button"
                          onClick={() => handleSelectCluster(cluster)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text transition ${
                            activeView === `cluster-${cluster._id}`
                              ? "bg-chime-selected"
                              : "hover:bg-chime-selected"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-sm font-bold text-chime-text">
                            {getClusterInitial(cluster)}
                          </div>

                          <span className="min-w-0 flex-1 truncate">
                            {cluster.name || "Unnamed Cluster"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto space-y-2 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={handleDiscoverClusters}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
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

              <span className="min-w-0 flex-1 truncate">Discover</span>
            </button>

            <button
              onClick={handleOpenFriends}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
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

              <span className="min-w-0 flex-1 truncate">Friends</span>

              {requests.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chime-gold px-1.5 text-xs font-bold text-chime-text">
                  {requests.length}
                </span>
              )}
            </button>
          </div>
        </nav>

        <div className="shrink-0 border-t border-stone-200 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenProfile}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition ${
                activeView === "profile"
                  ? "bg-chime-selected"
                  : "hover:bg-chime-selected"
              }`}
              title="Open profile"
            >
              <div className="relative h-12 w-12 shrink-0">
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-chime-gold" />
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
              onClick={handleLogout}
              className="shrink-0 rounded-lg p-2 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <ConfirmModal
        isOpen={modal.isOpen}
        title={
          modal.type === "sendRequest" ? "Send friend request?" : "Log out?"
        }
        message={
          modal.type === "sendRequest"
            ? `Send a friend request to ${modal.user?.username}?`
            : "Are you sure you want to log out?"
        }
        confirmText={modal.type === "sendRequest" ? "Send Request" : "Log Out"}
        cancelText="Cancel"
        onConfirm={handleConfirmModal}
        onCancel={closeModal}
        loading={isModalLoading}
      />

      <CreateClusterModal
        isOpen={isCreateClusterModalOpen}
        onClose={() => setIsCreateClusterModalOpen(false)}
        onCreated={handleCreateCluster}
        onOpenDiscover={handleDiscoverClusters}
      />
    </>
  );
}

export default Sidebar;
