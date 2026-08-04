import { X } from "lucide-react";

function Sidebar({ mobile = false, onClose }) {
  return (
    <aside
      className={`h-screen w-72 flex-col border-r border-stone-200 bg-chime-background ${
        mobile ? "flex" : "hidden md:flex"
      }`}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-stone-200 px-5">
        <h1 className="text-2xl font-bold text-chime-text">Chime 🔔</h1>

        {/* Mobile Close Button */}
        {mobile && (
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-chime-text hover:bg-chime-selected"
            aria-label="Close sidebar"
          >
            <X size={22} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {/* Direct Messages */}
        <div>
          <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-chime-secondary">
            Direct Messages
          </h2>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text hover:bg-chime-selected">
            <div className="h-8 w-8 rounded-full bg-chime-gold" />
            Alex
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text hover:bg-chime-selected">
            <div className="h-8 w-8 rounded-full bg-chime-bright" />
            Rahul
          </button>
        </div>

        {/* Public Rooms */}
        <div className="mt-6">
          <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-chime-secondary">
            Public Rooms
          </h2>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text hover:bg-chime-selected">
            <span className="text-lg text-chime-secondary">#</span>
            General
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text hover:bg-chime-selected">
            <span className="text-lg text-chime-secondary">#</span>
            Gaming
          </button>
        </div>

        {/* Private Rooms */}
        <div className="mt-6">
          <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-chime-secondary">
            Private Rooms
          </h2>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-chime-text hover:bg-chime-selected">
            <span className="text-lg text-chime-secondary">#</span>
            Project
          </button>
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-stone-200 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-chime-gold" />

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-chime-text">
              Your Name
            </p>

            <p className="text-xs text-chime-secondary">Online</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
