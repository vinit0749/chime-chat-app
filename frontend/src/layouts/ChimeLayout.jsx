import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import Friends from "../components/Friends";
import Profile from "../components/Profile";
import PublicProfile from "../components/PublicProfile";
import DiscoverClusters from "../components/DiscoverClusters";
import { authFetch } from "../utils/authFetch";

function ChimeLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeView, setActiveView] = useState("chat");
  const [profileUserId, setProfileUserId] = useState(null);

  useEffect(() => {
    if (!selectedChat || selectedChat.type !== "dm") {
      return;
    }

    const checkFriendship = async () => {
      try {
        const response = await authFetch("http://localhost:5000/api/friends");

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
    setSelectedChat(chat);
    setProfileUserId(null);
    setActiveView("chat");
    setIsSidebarOpen(false);
  };

  const handleSelectCluster = (cluster) => {
    if (!cluster) {
      return;
    }

    setSelectedChat({
      type: "cluster",
      cluster,
    });
    setProfileUserId(null);
    setActiveView("chat");
    setIsSidebarOpen(false);
  };

  const handleDiscoverClusters = () => {
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("discover");
    setIsSidebarOpen(false);
  };

  const handleOpenFriends = () => {
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("friends");
    setIsSidebarOpen(false);
  };

  const handleOpenProfile = () => {
    setSelectedChat(null);
    setProfileUserId(null);
    setActiveView("profile");
    setIsSidebarOpen(false);
  };

  const handleOpenUserProfile = (userId) => {
    const actualUserId = typeof userId === "object" ? userId?._id : userId;

    if (!actualUserId) {
      console.error("Cannot open public profile: missing user ID.");
      return;
    }

    setSelectedChat(null);
    setProfileUserId(actualUserId);
    setActiveView("public-profile");
    setIsSidebarOpen(false);
  };

  const handleMessageFromProfile = (user) => {
    if (!user?._id) {
      return;
    }

    setSelectedChat({
      type: "dm",
      user,
      isFriend: Boolean(user.isFriend),
    });

    setProfileUserId(null);
    setActiveView("chat");
    setIsSidebarOpen(false);
  };

  const handleProfileBack = () => {
    setProfileUserId(null);
    setActiveView("chat");
  };

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-chime-background">
      <Sidebar
        onSelectChat={handleSelectChat}
        onSelectCluster={handleSelectCluster}
        onOpenDiscover={handleDiscoverClusters}
        onOpenFriendRequests={handleOpenFriends}
        onOpenProfile={handleOpenProfile}
        onOpenUserProfile={handleOpenUserProfile}
        activeView={activeView}
      />

      {isSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />

          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar
              mobile
              onClose={() => setIsSidebarOpen(false)}
              onSelectChat={handleSelectChat}
              onSelectCluster={handleSelectCluster}
              onOpenDiscover={handleDiscoverClusters}
              onOpenFriendRequests={handleOpenFriends}
              onOpenProfile={handleOpenProfile}
              onOpenUserProfile={handleOpenUserProfile}
              activeView={activeView}
            />
          </div>
        </>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-stone-200 bg-chime-background px-4 md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-chime-text transition hover:bg-chime-selected"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>

          <h1 className="ml-3 font-bold text-chime-text">Chime 🔔</h1>
        </header>

        {activeView === "discover" ? (
          <DiscoverClusters onSelectCluster={handleSelectCluster} />
        ) : activeView === "friends" ? (
          <Friends
            onOpenProfile={handleOpenUserProfile}
            onSelectChat={handleSelectChat}
          />
        ) : activeView === "profile" ? (
          <Profile onBack={handleProfileBack} />
        ) : activeView === "public-profile" ? (
          <PublicProfile
            userId={profileUserId}
            onBack={handleProfileBack}
            onMessage={handleMessageFromProfile}
          />
        ) : (
          <ChatArea
            selectedChat={selectedChat}
            onOpenProfile={handleOpenUserProfile}
            onOpenOwnProfile={handleOpenProfile}
          />
        )}
      </main>
    </div>
  );
}

export default ChimeLayout;
