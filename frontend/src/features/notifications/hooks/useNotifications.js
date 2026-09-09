import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { authFetch } from "../../../shared/utils/authFetch";

function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socket, setSocket] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError("");

      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();

      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : [],
      );
    } catch (error) {
      console.error("Fetch notifications error:", error);
      setError("Failed to load notifications");
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/unread-count`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notification unread count");
      }

      const data = await response.json();

      setUnreadCount(Number(data.unreadCount) || 0);
    } catch (error) {
      console.error("Fetch notification unread count error:", error);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/read-all`,
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          read: true,
        })),
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Mark all notifications read error:", error);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId) => {
    if (!notificationId) {
      return;
    }

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete notification");
      }

      setNotifications((currentNotifications) =>
        currentNotifications.filter(
          (notification) => String(notification._id) !== String(notificationId),
        ),
      );
    } catch (error) {
      console.error("Delete notification error:", error);
    }
  }, []);

  const deleteAllNotifications = useCallback(async () => {
    try {
      const response = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/all`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete all notifications");
      }

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Delete all notifications error:", error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    const newSocket = io(import.meta.env.VITE_BACKEND_URL, {
      auth: {
        token,
      },
    });

    setSocket(newSocket);

    const handleNotificationReceived = (notification) => {
      if (!notification?._id) {
        return;
      }

      setNotifications((currentNotifications) => {
        const alreadyExists = currentNotifications.some(
          (currentNotification) =>
            String(currentNotification._id) === String(notification._id),
        );

        if (alreadyExists) {
          return currentNotifications;
        }

        setUnreadCount((current) => current + 1);

        return [notification, ...currentNotifications];
      });
    };

    const handleNotificationUpdated = (payload) => {
      if (!payload?.notificationId) {
        return;
      }

      setNotifications((currentNotifications) => {
        let notificationWasUnread = false;

        const updatedNotifications = currentNotifications.map(
          (notification) => {
            if (String(notification._id) !== String(payload.notificationId)) {
              return notification;
            }

            notificationWasUnread = !notification.read;

            return {
              ...notification,
              ...(payload.read !== undefined ? { read: payload.read } : {}),
              ...(payload.actionStatus !== undefined
                ? { actionStatus: payload.actionStatus }
                : {}),
            };
          },
        );

        if (payload.read === true && notificationWasUnread) {
          setUnreadCount((current) => Math.max(0, current - 1));
        }

        return updatedNotifications;
      });
    };

    const handleNotificationDeleted = (payload) => {
      if (!payload?.notificationId) {
        return;
      }

      setNotifications((currentNotifications) => {
        const notification = currentNotifications.find(
          (item) => String(item._id) === String(payload.notificationId),
        );

        if (notification && !notification.read) {
          setUnreadCount((current) => Math.max(0, current - 1));
        }

        return currentNotifications.filter(
          (item) => String(item._id) !== String(payload.notificationId),
        );
      });
    };

    const handleNotificationsReadAll = () => {
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          read: true,
        })),
      );

      setUnreadCount(0);
    };

    const handleNotificationsDeletedAll = () => {
      setNotifications([]);
      setUnreadCount(0);
    };

    newSocket.on("notification_received", handleNotificationReceived);
    newSocket.on("notification_updated", handleNotificationUpdated);
    newSocket.on("notification_deleted", handleNotificationDeleted);
    newSocket.on("notifications_read_all", handleNotificationsReadAll);
    newSocket.on("notifications_deleted_all", handleNotificationsDeletedAll);

    return () => {
      newSocket.off("notification_received", handleNotificationReceived);
      newSocket.off("notification_updated", handleNotificationUpdated);
      newSocket.off("notification_deleted", handleNotificationDeleted);
      newSocket.off("notifications_read_all", handleNotificationsReadAll);
      newSocket.off("notifications_deleted_all", handleNotificationsDeletedAll);

      newSocket.disconnect();
      setSocket(null);
    };
  }, []);

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);

      await Promise.all([fetchNotifications(), fetchUnreadCount()]);

      setLoading(false);
    };

    loadNotifications();
  }, [fetchNotifications, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    socket,
    setNotifications,
    setUnreadCount,
    fetchNotifications,
    fetchUnreadCount,
    markAllNotificationsRead,
    deleteNotification,
    deleteAllNotifications,
  };
}

export default useNotifications;
