import { useState } from "react";
import {
  Check,
  Copy,
  Users,
  Settings,
  Crown,
  LogOut,
  Info,
  Trash2,
} from "lucide-react";

function ClusterContextMenu({
  isOwner = false,
  memberCount = 0,
  isPrivate = false,
  inviteCode = "",
  onMembers,
  onSettings,
  onTransferOwnership,
  onWipeChat,
  onDeleteCluster,
  onInfo,
  onLeaveCluster,
  loading = false,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyInviteCode = async () => {
    if (!inviteCode || copied) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error("Failed to copy invite code:", error);
    }
  };

  return (
    <div
      data-cluster-context-menu="true"
      className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-chime-background p-1.5 shadow-xl"
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {isPrivate && inviteCode && (
        <div className="my-1 border-y border-stone-200 px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-chime-secondary">
            Invite Code
          </p>

          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold tracking-wider text-chime-text">
              {inviteCode}
            </span>

            <button
              type="button"
              onClick={handleCopyInviteCode}
              disabled={loading}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={copied ? "Invite code copied" : "Copy invite code"}
              title={copied ? "Copied" : "Copy invite code"}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>

          {copied && (
            <p className="mt-1.5 text-[11px] font-medium text-chime-secondary">
              Copied
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onMembers}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Users size={17} className="shrink-0 text-chime-secondary" />
        <span>Members</span>
      </button>

      {isOwner ? (
        <>
          <button
            type="button"
            onClick={onSettings}
            disabled={loading}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Settings size={17} className="shrink-0 text-chime-secondary" />
            <span>Cluster Settings</span>
          </button>

          {memberCount === 1 ? (
            <button
              type="button"
              onClick={onDeleteCluster}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={17} className="shrink-0" />
              <span>Delete Cluster</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onTransferOwnership}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Crown size={17} className="shrink-0 text-chime-secondary" />
              <span>Transfer Ownership</span>
            </button>
          )}

          <div className="my-1 border-t border-stone-200" />

          <button
            type="button"
            onClick={onWipeChat}
            disabled={loading}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={17} className="shrink-0" />
            <span>Wipe Chat</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onInfo}
            disabled={loading}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-chime-text transition hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Info size={17} className="shrink-0 text-chime-secondary" />
            <span>Cluster Info</span>
          </button>

          <button
            type="button"
            onClick={onLeaveCluster}
            disabled={loading}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut size={17} className="shrink-0" />
            <span>Leave Cluster</span>
          </button>
        </>
      )}
    </div>
  );
}

export default ClusterContextMenu;
