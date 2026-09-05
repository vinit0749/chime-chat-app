import { Check, X, Users, Sparkles } from "lucide-react";

function ClusterInvitationMessage({
  message,
  isOwnMessage,
  onRespond,
  responding = false,
}) {
  const cluster = message?.clusterInvite?.cluster;
  const status = message?.clusterInvite?.status || "pending";

  const clusterName = cluster?.name || "Private Cluster";
  const clusterDescription = cluster?.description?.trim();

  const senderName =
    message?.sender?.displayName || message?.sender?.username || "User";

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

  const statusContent = {
    accepted: isOwnMessage ? "Invitation accepted" : "You joined this Cluster",
    rejected: "Invitation rejected",
  };

  return (
    <div
      data-message-id={message?._id}
      className={`flex w-full gap-3 ${
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-chime-gold">
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
      </div>

      <div className="min-w-0 max-w-[70%]">
        <div
          className={`mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}
        >
          <span className="font-bold text-chime-text">
            {isOwnMessage ? "You" : senderName}
          </span>

          <span className="text-xs text-chime-secondary">{formattedTime}</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-chime-background text-left shadow-sm">
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chime-gold">
                <Sparkles size={14} className="text-chime-text" />
              </div>

              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-chime-secondary">
                Cluster Invitation
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-chime-gold shadow-sm">
                {cluster?.profilePicture ? (
                  <img
                    src={cluster.profilePicture}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-chime-text">
                    <Users size={22} strokeWidth={2} />
                  </div>
                )}
              </div>

              <div className="min-w-0 pt-0.5">
                <p className="truncate text-base font-extrabold text-chime-text">
                  {clusterName}
                </p>

                <p className="mt-0.5 text-xs font-medium text-chime-secondary">
                  Private Cluster
                </p>

                {clusterDescription && (
                  <p className="mt-2 text-xs leading-5 text-chime-secondary">
                    {clusterDescription}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 bg-chime-chat px-3.5 py-3">
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
                    <Check size={15} strokeWidth={2.5} />
                    Accept
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResponse("reject")}
                    disabled={responding}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-chime-background px-3 py-2.5 text-xs font-extrabold text-chime-text transition hover:-translate-y-0.5 hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <X size={15} strokeWidth={2.5} />
                    Reject
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-chime-chat px-3.5 py-2.5">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-chime-secondary" />

                  <p className="text-xs font-semibold text-chime-secondary">
                    Waiting for their response...
                  </p>
                </div>
              )
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-chime-chat px-3.5 py-2.5">
                {status === "accepted" ? (
                  <Check
                    size={15}
                    strokeWidth={2.5}
                    className="shrink-0 text-chime-text"
                  />
                ) : (
                  <X
                    size={15}
                    strokeWidth={2.5}
                    className="shrink-0 text-chime-secondary"
                  />
                )}

                <p className="text-xs font-bold text-chime-text">
                  {statusContent[status] || "Invitation updated"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClusterInvitationMessage;
