import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Crown,
  Heart,
  MoreVertical,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { authFetch } from "../../../shared/utils/authFetch";
import NotificationsMenu from "./NotificationsMenu";

function formatNotificationTime(createdAt) {
  if (!createdAt) {
    return "";
  }

  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function getNotificationContent(notification) {
  const actor =
    notification.actor?.displayName ||
    notification.actor?.username ||
    "Someone";

  switch (notification.type) {
    case "friend_request":
      if (notification.actionStatus === "accepted") {
        return {
          text: `You accepted ${actor}'s friend request`,
          icon: Check,
          actionLabel: "Accepted",
        };
      }

      if (notification.actionStatus === "declined") {
        return {
          text: `You declined ${actor}'s friend request`,
          icon: X,
          actionLabel: "Declined",
        };
      }

      return {
        text: `${actor} sent you a friend request`,
        icon: UserPlus,
      };

    case "friend_request_accepted":
      return {
        text: `${actor} accepted your friend request`,
        icon: Check,
      };

    case "dm":
      return {
        text: `${actor} sent you a message`,
        icon: Heart,
        clickable: true,
      };

    case "cluster_invitation":
      if (notification.actionStatus === "accepted") {
        return {
          text: `You accepted ${actor}'s invitation to ${
            notification.target?.name || "the Cluster"
          }`,
          icon: Check,
          actionLabel: "Accepted",
        };
      }

      if (notification.actionStatus === "declined") {
        return {
          text: `You declined ${actor}'s invitation to ${
            notification.target?.name || "the Cluster"
          }`,
          icon: X,
          actionLabel: "Declined",
        };
      }

      return {
        text: `${actor} invited you to ${
          notification.target?.name || "a Cluster"
        }`,
        icon: Users,
        actions: true,
      };

    case "cluster_join_request":
      return {
        text: `${actor} wants to join ${
          notification.target?.name || "your Cluster"
        }`,
        icon: Users,
        actions: true,
      };

    case "cluster_join_request_approved":
      return {
        text: `Your request to join ${
          notification.target?.name || "the Cluster"
        } was approved`,
        icon: Check,
        clickable: true,
      };

    case "cluster_join_request_rejected":
      return {
        text: `Your request to join ${
          notification.target?.name || "the Cluster"
        } was declined`,
        icon: X,
      };

    case "cluster_ownership_transferred":
      return {
        text: `${actor} transferred ownership of ${
          notification.target?.name || "the Cluster"
        } to you`,
        icon: Crown,
        clickable: true,
      };

    case "cluster_member_removed":
      return {
        text: `${actor} removed you from ${
          notification.target?.name || "a Cluster"
        }`,
        icon: X,
      };

    default:
      return {
        text: "You have a new notification",
        icon: Heart,
      };
  }
}

function NotificationAvatar({ actor }) {
  const name = actor?.displayName || actor?.username || "Someone";

  if (actor?.profilePicture) {
    return (
      <img
        src={actor.profilePicture}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chime-selected text-sm font-semibold text-chime-text">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Notifications({
  onBack,
  notifications,
  unreadCount,
  loading,
  error,
  socket,
  deleteAllNotifications,
  deleteNotification,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationMenu, setNotificationMenu] = useState(null);

  const handleFriendRequest = async (notification, action) => {
    const userId = notification.actor?._id;

    if (!userId || notification.actionStatus) {
      return;
    }

    try {
      const endpoint =
        action === "accept"
          ? `http://localhost:5000/api/friends/accept/${userId}`
          : `http://localhost:5000/api/friends/reject/${userId}`;

      const response = await authFetch(endpoint, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data.message || "Failed to process friend request.");
      }
    } catch (error) {
      console.error("Failed to process friend request:", error);
    }
  };

  const handleClusterInvitation = (notification, action) => {
    if (
      !socket ||
      !socket.connected ||
      !notification?.reference ||
      notification.type !== "cluster_invitation" ||
      notification.actionStatus
    ) {
      return;
    }

    socket.emit("cluster_invitation_response", {
      messageId: notification.reference,
      action,
    });
  };

  const handleDeleteAll = async () => {
    setMenuOpen(false);
    await deleteAllNotifications();
  };

  const handleNotificationContextMenu = (event, notificationId) => {
    event.preventDefault();

    setMenuOpen(false);

    setNotificationMenu({
      notificationId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleDeleteNotification = async () => {
    if (!notificationMenu?.notificationId) {
      return;
    }

    const notificationId = notificationMenu.notificationId;

    setNotificationMenu(null);

    await deleteNotification(notificationId);
  };

  return (
    <section
      className="flex h-full min-w-0 flex-1 flex-col bg-chime-background"
      onClick={() => {
        if (menuOpen) {
          setMenuOpen(false);
        }

        if (notificationMenu) {
          setNotificationMenu(null);
        }
      }}
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-5">
        <div className="flex items-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBack();
            }}
            className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text md:hidden"
            aria-label="Go back"
            title="Back"
          >
            <ArrowLeft size={19} />
          </button>

          <div>
            <h1 className="text-lg font-semibold text-chime-text">
              Notifications
            </h1>

            {unreadCount > 0 && (
              <p className="mt-0.5 text-xs text-chime-secondary">
                {unreadCount} unread
              </p>
            )}
          </div>
        </div>

        <div className="relative" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setNotificationMenu(null);
              setMenuOpen((current) => !current);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            aria-label="Notification options"
            title="Options"
          >
            <MoreVertical size={19} />
          </button>

          {menuOpen && (
            <NotificationsMenu mode="clear-all" onDeleteAll={handleDeleteAll} />
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-5 py-8">
            <p className="text-sm text-chime-secondary">
              Loading notifications...
            </p>
          </div>
        ) : error ? (
          <div className="px-5 py-8">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-chime-selected text-chime-secondary">
                <Heart size={21} />
              </div>

              <h2 className="text-sm font-semibold text-chime-text">
                You're all caught up
              </h2>

              <p className="mt-1 text-xs text-chime-secondary">
                New activity will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {notifications.map((notification) => {
              const content = getNotificationContent(notification);
              const Icon = content.icon;

              const showFriendActions =
                notification.type === "friend_request" &&
                !notification.actionStatus;

              const showClusterInvitationActions =
                notification.type === "cluster_invitation" &&
                !notification.actionStatus;

              return (
                <div
                  key={notification._id}
                  onContextMenu={(event) =>
                    handleNotificationContextMenu(event, notification._id)
                  }
                  className={`relative flex w-full items-center gap-3 border-b border-stone-200 px-5 py-4 transition ${
                    notification.read
                      ? "bg-chime-background"
                      : "bg-chime-selected/40"
                  } ${
                    content.clickable
                      ? "cursor-pointer hover:bg-chime-selected"
                      : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <NotificationAvatar actor={notification.actor} />

                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-chime-background bg-chime-text text-chime-gold">
                      <Icon size={10} strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {!notification.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-chime-gold" />
                      )}

                      <p className="text-sm leading-5 text-chime-text">
                        {content.text}
                      </p>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-chime-secondary">
                      <Clock size={12} />

                      <span>
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>

                    {showFriendActions && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleFriendRequest(notification, "accept")
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-chime-gold px-3 py-1.5 text-xs font-semibold text-chime-text transition hover:opacity-90"
                        >
                          <Check size={14} />
                          Accept
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleFriendRequest(notification, "reject")
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-chime-secondary transition hover:bg-stone-100 hover:text-chime-text"
                        >
                          <X size={14} />
                          Decline
                        </button>
                      </div>
                    )}

                    {showClusterInvitationActions && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleClusterInvitation(notification, "accept")
                          }
                          disabled={!socket?.connected}
                          className="flex items-center gap-1.5 rounded-lg bg-chime-gold px-3 py-1.5 text-xs font-semibold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Check size={14} />
                          Accept
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleClusterInvitation(notification, "reject")
                          }
                          disabled={!socket?.connected}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-chime-secondary transition hover:bg-stone-100 hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X size={14} />
                          Decline
                        </button>
                      </div>
                    )}

                    {content.actionLabel && (
                      <div className="mt-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            notification.actionStatus === "accepted"
                              ? "bg-chime-gold text-chime-text"
                              : "border border-stone-300 bg-white text-chime-secondary"
                          }`}
                        >
                          {notification.actionStatus === "accepted" ? (
                            <Check size={14} />
                          ) : (
                            <X size={14} />
                          )}

                          {content.actionLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {!notification.read && (
                    <div className="shrink-0">
                      <span className="block h-2 w-2 rounded-full bg-chime-gold" />
                    </div>
                  )}

                  {notificationMenu?.notificationId === notification._id && (
                    <div
                      className="fixed z-[100]"
                      style={{
                        left: notificationMenu.x,
                        top: notificationMenu.y,
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <NotificationsMenu
                        mode="delete"
                        onDelete={handleDeleteNotification}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default Notifications;
