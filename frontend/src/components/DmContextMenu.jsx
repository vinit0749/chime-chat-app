import { UserRound, UserMinus, UserRoundX, UserRoundCheck } from "lucide-react";

function DmContextMenu({
  user,
  onViewProfile,
  onUnfriend,
  onBlock,
  onUnblock,
  showUnfriend = true,
  showBlock = true,
  showUnblock = false,
  placement = "sidebar",
  loading = false,
}) {
  if (!user) {
    return null;
  }

  const placementClass =
    placement === "chat"
      ? "absolute right-0 top-full mt-2"
      : "absolute left-3 top-full mt-1";

  return (
    <div
      className={`${placementClass} z-50 w-52 overflow-hidden rounded-xl border border-stone-200 bg-chime-background p-1.5 shadow-xl`}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={onViewProfile}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserRound size={17} className="shrink-0 text-chime-secondary" />
        <span>View Profile</span>
      </button>

      {showUnfriend && (
        <button
          type="button"
          onClick={onUnfriend}
          disabled={loading}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserMinus size={17} className="shrink-0 text-chime-secondary" />
          <span>Unfriend</span>
        </button>
      )}

      {showBlock && (
        <button
          type="button"
          onClick={onBlock}
          disabled={loading}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserRoundX size={17} className="shrink-0" />
          <span>Block</span>
        </button>
      )}

      {showUnblock && (
        <button
          type="button"
          onClick={onUnblock}
          disabled={loading}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserRoundCheck size={17} className="shrink-0 text-chime-secondary" />

          <span>Unblock</span>
        </button>
      )}
    </div>
  );
}

export default DmContextMenu;
