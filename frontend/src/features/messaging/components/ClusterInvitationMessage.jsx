import { Check, X, Users, Sparkles } from "lucide-react";

function ClusterInvitationMessage({
  message,
  isOwnMessage,
  onRespond,
  responding = false,
  onOpenProfile,
}) {
  const cluster = message?.clusterInvite?.cluster;
  const status = message?.clusterInvite?.status || "pending";

  const clusterName = cluster?.name || "Private Cluster";
  const clusterDescription = cluster?.description?.trim();

  const senderName =
    message?.sender?.displayName || message?.sender?.username || "User";

  const senderId = message?.sender?._id;

  const formattedTime = message?.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const handleResponse = (action) => {
    if (responding || status !== "pending" || !message?._id) {
      return;
    }

    onRespond?.(message._id, action);
  };

  const handleOpenProfile = () => {
    if (!senderId || !onOpenProfile) {
      return;
    }

    onOpenProfile(senderId);
  };

  const statusContent = {
    accepted: isOwnMessage ? "Invitation accepted" : "You joined this Cluster",
    rejected: "Invitation rejected",
  };

  return (
    <div
      data-message-id={message?._id}
      className={`flex w-full gap-0 sm:gap-3 ${
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <button
        type="button"
        onClick={handleOpenProfile}
        disabled={!senderId || !onOpenProfile}
        aria-label={`Open ${senderName}'s profile`}
        className={`hidden h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold sm:block ${
          senderId && onOpenProfile
            ? "cursor-pointer transition hover:opacity-85"
            : "cursor-default"
        } disabled:cursor-default`}
      >
        {message?.sender?.profilePicture ? (
          <img
            src={message.sender.profilePicture}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-chime-text">
            {senderName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      <div
        className={`min-w-0 max-w-[70%] ${
          isOwnMessage ? "text-right" : "text-left"
        }`}
      >
        <div className="mb-1 text-[11px] font-bold text-chime-secondary">
          {isOwnMessage ? "You" : senderName}
        </div>

        <div
          className={`overflow-hidden rounded-2xl border text-left shadow-sm ${
            isOwnMessage
              ? "rounded-tr-md border-chime-gold bg-chime-background"
              : "rounded-tl-md border-stone-200 bg-chime-background"
          }`}
        >
          <div className="p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chime-gold">
                <Sparkles size={14} className="text-chime-text" />
              </div>

              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-chime-secondary">
                Cluster Invitation
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-chime-gold/80">
                {cluster?.profilePicture ? (
                  <img
                    src={cluster.profilePicture}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-chime-text">
                    <Users size={20} strokeWidth={2} />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-chime-text">
                  {clusterName}
                </p>

                <p className="mt-0.5 text-[11px] font-semibold text-chime-secondary">
                  Private Cluster
                </p>
              </div>
            </div>

            {clusterDescription && (
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-chime-secondary">
                {clusterDescription}
              </p>
            )}

            <div className="mt-3 border-t border-stone-200/70 pt-3">
              <p className="text-xs font-semibold leading-5 text-chime-text">
                {isOwnMessage
                  ? "You've invited this user to join your Cluster."
                  : "You've been invited to join this Cluster."}
              </p>
            </div>

            {status === "pending" ? (
              !isOwnMessage ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleResponse("accept")}
                    disabled={responding}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-chime-gold px-3 py-2.5 text-xs font-extrabold text-chime-text transition hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <Check size={14} strokeWidth={2.5} />
                    Accept
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResponse("reject")}
                    disabled={responding}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-chime-background px-3 py-2.5 text-xs font-extrabold text-chime-text transition hover:-translate-y-0.5 hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <X size={14} strokeWidth={2.5} />
                    Reject
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-chime-chat px-3 py-2.5">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-chime-secondary" />

                  <p className="text-[11px] font-semibold text-chime-secondary">
                    Waiting for their response...
                  </p>
                </div>
              )
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-chime-chat px-3 py-2.5">
                {status === "accepted" ? (
                  <Check
                    size={14}
                    strokeWidth={2.5}
                    className="shrink-0 text-chime-text"
                  />
                ) : (
                  <X
                    size={14}
                    strokeWidth={2.5}
                    className="shrink-0 text-chime-secondary"
                  />
                )}

                <p className="text-[11px] font-bold text-chime-text">
                  {statusContent[status] || "Invitation updated"}
                </p>
              </div>
            )}

            {formattedTime && (
              <div className="mt-2 text-[10px] leading-none text-chime-secondary">
                {formattedTime}
                {isOwnMessage && (
                  <span className="ml-1 text-[11px] font-semibold">✓✓</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClusterInvitationMessage;
