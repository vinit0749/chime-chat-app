import { Check, X, Users } from "lucide-react";

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

  const handleResponse = (action) => {
    if (responding || status !== "pending" || !message?._id) {
      return;
    }

    onRespond?.(message._id, action);
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

      <div
        className={`min-w-0 max-w-[70%] ${
          isOwnMessage ? "text-right" : "text-left"
        }`}
      >
        <div
          className={`mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}
        >
          <span className="font-bold text-chime-text">
            {isOwnMessage ? "You" : senderName}
          </span>

          <span className="text-xs text-chime-secondary">
            {message?.createdAt
              ? new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : ""}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-sm">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-chime-gold">
                {cluster?.profilePicture ? (
                  <img
                    src={cluster.profilePicture}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-chime-text">
                    <Users size={20} />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold text-chime-text">
                  {clusterName}
                </p>

                {clusterDescription && (
                  <p className="mt-1 text-xs leading-5 text-chime-secondary">
                    {clusterDescription}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-chime-chat px-3 py-2.5">
              <p className="text-xs font-semibold text-chime-text">
                {isOwnMessage
                  ? "Cluster invitation sent"
                  : "You've been invited to join this Cluster."}
              </p>
            </div>

            {status === "pending" ? (
              !isOwnMessage ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleResponse("accept")}
                    disabled={responding}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-chime-gold px-3 py-2.5 text-xs font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check size={15} />
                    Accept
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResponse("reject")}
                    disabled={responding}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-chime-chat px-3 py-2.5 text-xs font-bold text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X size={15} />
                    Reject
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs font-medium text-chime-secondary">
                  Waiting for their response...
                </p>
              )
            ) : (
              <div className="mt-3 rounded-xl bg-chime-chat px-3 py-2.5">
                <p className="text-xs font-bold text-chime-text">
                  {status === "accepted"
                    ? isOwnMessage
                      ? "Invitation accepted"
                      : "You joined this Cluster"
                    : "Invitation rejected"}
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
