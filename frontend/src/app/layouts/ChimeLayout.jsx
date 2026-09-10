import { useCallback, useEffect, useState } from "react";

import Sidebar from "../../features/navigation/components/Sidebar/Sidebar";
import ChatArea from "../../features/messaging/components/ChatArea/ChatArea";
import Friends from "../../features/friends/components/Friends";
import Profile from "../../features/users/components/Profile";
import PublicProfile from "../../features/users/components/PublicProfile";
import DiscoverClusters from "../../features/clusters/components/DiscoverClusters";
import Notifications from "../../features/notifications/components/Notifications";
import useNotifications from "../../features/notifications/hooks/useNotifications";
import { authFetch } from "../../shared/utils/authFetch";

function ChimeLayout() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeView, setActiveView] = useState("chat");
  const [mobileView, setMobileView] = useState("sidebar");
  const [sidebarSection, setSidebarSection] = useState("dms");
  const [profileUserId, setProfileUserId] = useState(null);
  const [clusterMenuAction, setClusterMenuAction] = useState(null);

  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    socket: notificationSocket,
    markAllNotificationsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();

  useEffect(() => {
    if (!selectedChat || selectedChat.type !== "dm") {
      return;
    }

    const checkFriendship = async () => {
      try {
        const response = await authFetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/friends`,
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const friends = data.friends || [];

        const isFriend = friends.some(
          (friend) => friend._id === selectedChat.user._id,
        );

        setSelectedChat((currentChat) => {
          if (
            !currentChat ||
            currentChat.type !== "dm" ||
            currentChat.user._id !== selectedChat.user._id
          ) {
            return currentChat;
          }

          if (currentChat.isFriend === isFriend) {
            return currentChat;
          }

          return {
            ...currentChat,
            isFriend,
          };
        });
      } catch (error) {
        console.error("Failed to check friendship:", error);
      }
    };

    checkFriendship();

    const interval = setInterval(checkFriendship, 2000);

    return () => clearInterval(interval);
  }, [selectedChat?.type, selectedChat?.user?._id]);

  const handleSelectChat = (chat) => {
    setClusterMenuAction(null);
    setSelectedChat(chat);
    setProfileUserId(null);
    setActiveView("chat");
    setMobileView(chat ? "chat" : "sidebar");
  };

  const handleSelectCluster = (cluster) => {
    if (!cluster) {
      setClusterMenuAction(null);
      setSelectedChat(null);
      setProfileUserId(null);
      setActiveView("chat");
      setMobileView("sidebar");
      return;
    }

    setClusterMenuAction(null);
    setSelectedChat({
      type: "cluster",
      cluster,
    });
    setProfileUserId(null);
    setActiveView("chat");
    setMobileView("chat");
  };

  const handleClusterUpdated = useCallback((updatedCluster) => {
    if (!updatedCluster?._id) {
      return;
    }

    setSelectedChat((currentChat) => {
      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        String(currentChat.cluster?._id) !== String(updatedCluster._id)
      ) {
        return currentChat;
      }

      return {
        ...currentChat,
        cluster: {
          ...currentChat.cluster,
          ...updatedCluster,
        },
      };
    });
  }, []);

  const handleClusterDeleted = useCallback((clusterId) => {
    if (!clusterId) {
      return;
    }

    setClusterMenuAction(null);

    setSelectedChat((currentChat) => {
      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        String(currentChat.cluster?._id) !== String(clusterId)
      ) {
        return currentChat;
      }

      return null;
    });

    setActiveView("chat");
    setMobileView("sidebar");
  }, []);

  const handleUserDeleted = useCallback((userId) => {
    if (!userId) {
      return;
    }

    setSelectedChat((currentChat) => {
      if (
        !currentChat ||
        currentChat.type !== "dm" ||
        String(currentChat.user?._id) !== String(userId)
      ) {
        return currentChat;
      }

      return null;
    });

    setActiveView("chat");
    setMobileView("sidebar");
  }, []);

  const handleClusterLeft = useCallback((clusterId) => {
    if (!clusterId) {
      return;
    }

    setClusterMenuAction(null);

    setSelectedChat((currentChat) => {
      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        String(currentChat.cluster?._id) !== String(clusterId)
      ) {
        return currentChat;
      }

      return null;
    });

    setActiveView("chat");
    setMobileView("sidebar");
  }, []);

  const handleClusterMenuAction = useCallback((action, cluster) => {
    if (!cluster?._id) {
      return;
    }

    setSelectedChat((currentChat) => {
      if (
        !currentChat ||
        currentChat.type !== "cluster" ||
        String(currentChat.cluster?._id) !== String(cluster._id)
      ) {
        return {
          type: "cluster",
          cluster,
        };
      }

      return {
        ...currentChat,
        cluster: {
          ...currentChat.cluster,
          ...cluster,
        },
      };
    });

    setActiveView("chat");
    setProfileUserId(null);
    setMobileView("chat");

    setClusterMenuAction({
      action,
      clusterId: String(cluster._id),
    });
  }, []);

  const handleClusterMenuDeleteCluster = useCallback(
    (cluster) => {
      handleClusterMenuAction("delete", cluster);
    },
    [handleClusterMenuAction],
  );

  const handleClusterMenuWipeChat = useCallback(
    (cluster) => {
      handleClusterMenuAction("wipe", cluster);
    },
    [handleClusterMenuAction],
  );

  const handleClusterMenuActionHandled = useCallback(() => {
    setClusterMenuAction(null);
  }, []);

  const handleDiscoverClusters = () => {
    setClusterMenuAction(null);
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("discover");
    setMobileView("discover");
  };

  const handleDiscoverBack = () => {
    setClusterMenuAction(null);
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("chat");
    setMobileView("sidebar");
  };

  const handleOpenFriends = () => {
    setClusterMenuAction(null);
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("friends");
    setMobileView("friends");
  };

  const handleOpenProfile = () => {
    setClusterMenuAction(null);
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("profile");
    setMobileView("profile");
  };

  const handleOpenNotifications = () => {
    setClusterMenuAction(null);
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("notifications");
    setMobileView("notifications");

    if (unreadCount > 0) {
      markAllNotificationsRead();
    }
  };

  const handleOpenUserProfile = (userId) => {
    const actualUserId = typeof userId === "object" ? userId?._id : userId;

    if (!actualUserId) {
      console.error("Cannot open public profile: missing user ID.");
      return;
    }

    setClusterMenuAction(null);
    setSelectedChat(null);
    setProfileUserId(actualUserId);
    setActiveView("public-profile");
    setMobileView("public-profile");
  };

  const handleMessageFromProfile = (user) => {
    if (!user?._id) {
      return;
    }

    setClusterMenuAction(null);
    setSelectedChat({
      type: "dm",
      user,
      isFriend: Boolean(user.isFriend),
    });

    setProfileUserId(null);
    setActiveView("chat");
    setMobileView("chat");
  };

  const handleMobileBack = () => {
    setClusterMenuAction(null);
    setActiveView("chat");
    setMobileView("sidebar");
  };

  const handleProfileBack = () => {
    setProfileUserId(null);
    setActiveView("chat");
    setMobileView("sidebar");
  };

  const renderContent = () => {
    if (activeView === "discover") {
      return (
        <DiscoverClusters
          onSelectCluster={handleSelectCluster}
          onBack={handleDiscoverBack}
        />
      );
    }

    if (activeView === "friends") {
      return (
        <Friends
          onOpenProfile={handleOpenUserProfile}
          onSelectChat={handleSelectChat}
          onBack={handleMobileBack}
        />
      );
    }

    if (activeView === "profile") {
      return <Profile onBack={handleProfileBack} />;
    }

    if (activeView === "public-profile") {
      return (
        <PublicProfile
          userId={profileUserId}
          onBack={handleProfileBack}
          onMessage={handleMessageFromProfile}
        />
      );
    }

    if (activeView === "notifications") {
      return (
        <Notifications
          onBack={handleMobileBack}
          notifications={notifications}
          unreadCount={unreadCount}
          loading={notificationsLoading}
          error={notificationsError}
          socket={notificationSocket}
          deleteNotification={deleteNotification}
          deleteAllNotifications={deleteAllNotifications}
        />
      );
    }

    return (
      <ChatArea
        selectedChat={selectedChat}
        onOpenProfile={handleOpenUserProfile}
        onUserDeleted={handleUserDeleted}
        onOpenOwnProfile={handleOpenProfile}
        onSelectChat={handleSelectChat}
        onClusterUpdated={handleClusterUpdated}
        onClusterDeleted={handleClusterDeleted}
        onClusterLeft={handleClusterLeft}
        clusterMenuAction={clusterMenuAction}
        onClusterMenuActionHandled={handleClusterMenuActionHandled}
        onMobileBack={handleMobileBack}
      />
    );
  };

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-chime-background md:h-screen max-md:h-dvh">
      <div className="hidden w-72 shrink-0 md:flex">
        <Sidebar
          sidebarSection={sidebarSection}
          onSidebarSectionChange={setSidebarSection}
          onSelectChat={handleSelectChat}
          onSelectCluster={handleSelectCluster}
          onOpenDiscover={handleDiscoverClusters}
          onOpenFriendRequests={handleOpenFriends}
          onOpenProfile={handleOpenProfile}
          onOpenNotifications={handleOpenNotifications}
          onOpenUserProfile={handleOpenUserProfile}
          onClusterUpdated={handleClusterUpdated}
          onClusterDeleted={handleClusterDeleted}
          onClusterMenuAction={handleClusterMenuAction}
          onClusterMenuDeleteCluster={handleClusterMenuDeleteCluster}
          onClusterMenuWipeChat={handleClusterMenuWipeChat}
          notificationUnreadCount={unreadCount}
          activeView={activeView}
        />
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="hidden min-h-0 min-w-0 flex-1 overflow-hidden md:flex">
          {renderContent()}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden md:hidden">
          {mobileView === "sidebar" ? (
            <Sidebar
              mobile
              sidebarSection={sidebarSection}
              onSidebarSectionChange={setSidebarSection}
              onSelectChat={handleSelectChat}
              onSelectCluster={handleSelectCluster}
              onOpenDiscover={handleDiscoverClusters}
              onOpenFriendRequests={handleOpenFriends}
              onOpenProfile={handleOpenProfile}
              onOpenNotifications={handleOpenNotifications}
              onOpenUserProfile={handleOpenUserProfile}
              onClusterUpdated={handleClusterUpdated}
              onClusterDeleted={handleClusterDeleted}
              onClusterMenuAction={handleClusterMenuAction}
              onClusterMenuDeleteCluster={handleClusterMenuDeleteCluster}
              onClusterMenuWipeChat={handleClusterMenuWipeChat}
              notificationUnreadCount={unreadCount}
              activeView={activeView}
            />
          ) : (
            renderContent()
          )}
        </div>
      </main>
    </div>
  );
}

export default ChimeLayout;
