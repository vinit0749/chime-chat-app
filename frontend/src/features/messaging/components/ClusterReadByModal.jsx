import { createPortal } from "react-dom";

const ClusterReadByModal = ({ readers = [], onClose }) => {
  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cluster-read-by-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2
            id="cluster-read-by-title"
            className="text-lg font-bold text-chime-text"
          >
            Seen by
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-chime-secondary transition hover:bg-stone-100 hover:text-chime-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="chime-scrollbar max-h-[60vh] overflow-y-auto p-3">
          {readers.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-chime-secondary">
              No one has seen this message yet.
            </p>
          ) : (
            readers.map((reader) => {
              const readerName =
                reader.displayName?.trim() ||
                reader.username?.trim() ||
                "Unknown User";

              return (
                <div
                  key={reader.userId}
                  className="flex items-center gap-3 rounded-xl px-3 py-3"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold">
                    {reader.profilePicture ? (
                      <img
                        src={reader.profilePicture}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-chime-text">
                        {readerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-chime-text">
                      {readerName}
                    </p>

                    {reader.username && (
                      <p className="truncate text-xs text-chime-secondary">
                        @{reader.username}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ClusterReadByModal;
