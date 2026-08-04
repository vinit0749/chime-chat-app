import { useState } from "react";
import { Menu } from "lucide-react";

import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";

function ChimeLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-chime-background">
      {/* Desktop Sidebar */}
      <Sidebar />

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
            <Sidebar mobile onClose={() => setIsSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex h-16 items-center border-b border-stone-200 bg-chime-background px-4 md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-chime-text hover:bg-chime-selected"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>

          <h1 className="ml-3 font-bold text-chime-text">Chime 🔔</h1>
        </header>

        <ChatArea />
      </main>
    </div>
  );
}

export default ChimeLayout;
