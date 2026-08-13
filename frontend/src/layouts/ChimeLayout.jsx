import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import Friends from "../components/Friends";
import { authFetch } from "../utils/authFetch";

function ChimeLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeView, setActiveView] = useState("chat");

  /*
    Keep the selected DM's friendship status up to date.

    This matters because friendship can change from another
    account/device while this DM is already open.
  */
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
    setActiveView("chat");
    setIsSidebarOpen(false);
  };

  const handleOpenFriends = () => {
    setSelectedChat(null);
    setActiveView("friends");
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-chime-background">
      {/* Desktop Sidebar */}
      <Sidebar
        onSelectChat={handleSelectChat}
        onOpenFriendRequests={handleOpenFriends}
        activeView={activeView}
      />

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar
              mobile
              onClose={() => setIsSidebarOpen(false)}
              onSelectChat={handleSelectChat}
              onOpenFriendRequests={handleOpenFriends}
              activeView={activeView}
            />
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
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

        {/* Main View */}
        {activeView === "friends" ? (
          <Friends />
        ) : (
          <ChatArea selectedChat={selectedChat} />
        )}
      </main>
    </div>
  );
}

export default ChimeLayout;
