import { Trash2 } from "lucide-react";

function NotificationsMenu({ mode, onDeleteAll, onDelete }) {
  const isClearAll = mode === "clear-all";

  return (
    <div
      className={
        isClearAll
          ? "absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg"
          : "w-48 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg"
      }
    >
      {isClearAll ? (
        <button
          type="button"
          onClick={onDeleteAll}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-500 transition hover:bg-stone-100"
        >
          <Trash2 size={16} />
          Clear notifications
        </button>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-500 transition hover:bg-stone-100"
        >
          <Trash2 size={16} />
          Delete notification
        </button>
      )}
    </div>
  );
}

export default NotificationsMenu;
