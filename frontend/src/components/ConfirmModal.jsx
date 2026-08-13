import { X } from "lucide-react";

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-chime-background p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-chime-text">{title}</h2>

            <p className="mt-2 text-sm leading-6 text-chime-secondary">
              {message}
            </p>
          </div>

          <button
            onClick={onCancel}
            disabled={loading}
            className="shrink-0 rounded-lg p-1.5 text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-chime-gold px-4 py-2.5 text-sm font-bold text-chime-text transition hover:bg-chime-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
