import {
  ArrowRight,
  CalendarDays,
  Crown,
  LogOut,
  Users,
  X,
} from "lucide-react";

function ClusterInfoPanel({
  isOpen,
  cluster,
  onClose,
  onOpenMembers,
  onLeaveCluster,
}) {
  if (!isOpen || !cluster) {
    return null;
  }

  const clusterName = cluster.name || "Unnamed Cluster";
  const clusterInitial = clusterName.charAt(0).toUpperCase();

  const visibility =
    String(cluster.visibility || "public").toLowerCase() === "public"
      ? "Public"
      : "Private";

  const ownerName =
    cluster.owner?.displayName || cluster.owner?.username || "Unknown owner";

  const ownerUsername = cluster.owner?.username
    ? `@${cluster.owner.username}`
    : "";

  const memberCount = Number(cluster.memberCount || 0);

  const createdDate = cluster.createdAt
    ? new Date(cluster.createdAt).toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Unknown";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Close Cluster info"
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-chime-text">Cluster Info</h2>

            <p className="mt-0.5 text-xs text-chime-secondary">
              About this Cluster
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>

        <div className="px-6 py-6">
          <section className="text-center">
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-2xl bg-chime-gold shadow-sm ring-1 ring-stone-200">
              {cluster.profilePicture ? (
                <img
                  src={cluster.profilePicture}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-chime-text">
                  {clusterInitial}
                </div>
              )}
            </div>

            <h3 className="mt-4 truncate text-xl font-bold text-chime-text">
              {clusterName}
            </h3>

            <p className="mx-auto mt-1.5 max-w-md text-sm leading-5 text-chime-secondary">
              {cluster.description || "No description has been added yet."}
            </p>

            <span className="mt-3 inline-flex rounded-full bg-chime-gold px-3 py-1.5 text-xs font-bold text-chime-text">
              {visibility} Cluster
            </span>
          </section>

          <div className="my-6 border-t border-stone-200" />

          <section className="grid grid-cols-3 divide-x divide-stone-200">
            <div className="px-4 text-center first:pl-0">
              <Crown size={18} className="mx-auto text-chime-secondary" />

              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-chime-secondary">
                Owner
              </p>

              <p className="mt-1 truncate text-xs font-semibold text-chime-text">
                {ownerName}
              </p>

              {ownerUsername && (
                <p className="mt-0.5 truncate text-[10px] text-chime-secondary">
                  {ownerUsername}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMembers?.();
              }}
              className="group mx-2 rounded-xl px-3 py-2 text-center transition hover:bg-chime-selected"
              aria-label="View Cluster members"
            >
              <Users
                size={18}
                className="mx-auto text-chime-secondary transition group-hover:text-chime-text"
              />

              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-chime-secondary">
                Members
              </p>

              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="text-xs font-semibold text-chime-text">
                  {memberCount}
                </span>

                <ArrowRight
                  size={13}
                  className="text-chime-secondary transition group-hover:translate-x-0.5 group-hover:text-chime-text"
                />
              </div>

              <p className="mt-0.5 text-[10px] text-chime-secondary">
                View members
              </p>
            </button>

            <div className="px-4 text-center last:pr-0">
              <CalendarDays
                size={18}
                className="mx-auto text-chime-secondary"
              />

              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-chime-secondary">
                Created
              </p>

              <p className="mt-1 text-xs font-semibold text-chime-text">
                {createdDate}
              </p>
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLeaveCluster?.();
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={16} />
            Leave Cluster
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClusterInfoPanel;
