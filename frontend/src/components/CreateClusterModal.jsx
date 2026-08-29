import { useState } from "react";
import { X, Globe, Lock, Compass, ArrowRight, Users } from "lucide-react";
import { authFetch } from "../utils/authFetch";

function CreateClusterModal({ isOpen, onClose, onCreated, onOpenDiscover }) {
  const [mode, setMode] = useState("create");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [inviteCode, setInviteCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) {
    return null;
  }

  const isBusy = loading || joining;

  const handleClose = () => {
    if (isBusy) return;

    setName("");
    setDescription("");
    setVisibility("public");
    setInviteCode("");
    setError("");
    setMode("create");

    onClose();
  };

  const handleModeChange = (nextMode) => {
    if (isBusy) return;

    setMode(nextMode);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Cluster name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authFetch("http://localhost:5000/api/clusters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          visibility,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to create Cluster.");
        return;
      }

      onCreated(data.cluster);

      setName("");
      setDescription("");
      setVisibility("public");
      setError("");
      onClose();
    } catch (error) {
      console.error("Failed to create Cluster:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (event) => {
    event.preventDefault();

    if (!inviteCode.trim()) {
      setError("Enter a Cluster invite code.");
      return;
    }

    setJoining(true);
    setError("");

    try {
      const response = await authFetch(
        "http://localhost:5000/api/clusters/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inviteCode: inviteCode.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to join Cluster.");
        return;
      }

      onCreated(data.cluster);

      setInviteCode("");
      setError("");
      onClose();
    } catch (error) {
      console.error("Failed to join Cluster:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleDiscover = () => {
    if (isBusy || !onOpenDiscover) return;

    onClose();
    onOpenDiscover();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-chime-background shadow-2xl">
        <div className="flex shrink-0 items-start justify-between px-6 py-5">
          <div className="min-w-0 pr-4">
            <h2 className="text-xl font-bold tracking-tight text-chime-text">
              Clusters
            </h2>

            <p className="mt-1.5 text-sm leading-5 text-chime-secondary">
              Create a community or join one you're already part of.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <div className="px-6 pb-5">
          <div className="flex rounded-xl bg-chime-chat p-1">
            <button
              type="button"
              onClick={() => handleModeChange("create")}
              disabled={isBusy}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                mode === "create"
                  ? "bg-chime-background text-chime-text shadow-sm"
                  : "text-chime-secondary hover:text-chime-text"
              }`}
            >
              Create
            </button>

            <button
              type="button"
              onClick={() => handleModeChange("join")}
              disabled={isBusy}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                mode === "join"
                  ? "bg-chime-background text-chime-text shadow-sm"
                  : "text-chime-secondary hover:text-chime-text"
              }`}
            >
              Join
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto border-t border-stone-200">
          {mode === "create" ? (
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="cluster-name"
                    className="text-sm font-semibold text-chime-text"
                  >
                    Cluster name
                  </label>

                  <span className="text-xs text-chime-secondary">
                    {name.length}/100
                  </span>
                </div>

                <input
                  id="cluster-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  placeholder="e.g. Gaming Squad"
                  className="h-11 w-full rounded-xl border border-stone-200 bg-chime-chat px-4 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/10"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="cluster-description"
                    className="text-sm font-semibold text-chime-text"
                  >
                    Description
                  </label>

                  <span className="text-xs text-chime-secondary">
                    {description.length}/500
                  </span>
                </div>

                <textarea
                  id="cluster-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="What is this Cluster about?"
                  className="w-full resize-none rounded-xl border border-stone-200 bg-chime-chat px-4 py-3 text-sm leading-5 text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/10"
                  disabled={loading}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-chime-text">
                    Visibility
                  </p>

                  <p className="mt-1 text-xs text-chime-secondary">
                    Choose who can find and join your Cluster.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    disabled={loading}
                    className={`flex min-h-[92px] items-start gap-3 rounded-xl border p-4 text-left transition ${
                      visibility === "public"
                        ? "border-chime-gold bg-chime-selected"
                        : "border-stone-200 hover:bg-chime-selected"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        visibility === "public"
                          ? "bg-chime-gold text-chime-text"
                          : "bg-chime-chat text-chime-secondary"
                      }`}
                    >
                      <Globe size={18} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-chime-text">
                        Public
                      </p>

                      <p className="mt-1 text-xs leading-5 text-chime-secondary">
                        Anyone can discover and join.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility("private")}
                    disabled={loading}
                    className={`flex min-h-[92px] items-start gap-3 rounded-xl border p-4 text-left transition ${
                      visibility === "private"
                        ? "border-chime-gold bg-chime-selected"
                        : "border-stone-200 hover:bg-chime-selected"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        visibility === "private"
                          ? "bg-chime-gold text-chime-text"
                          : "bg-chime-chat text-chime-secondary"
                      }`}
                    >
                      <Lock size={18} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-chime-text">
                        Private
                      </p>

                      <p className="mt-1 text-xs leading-5 text-chime-secondary">
                        Join only with an invite.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-w-[128px] items-center justify-center rounded-xl bg-chime-gold px-5 py-2.5 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Cluster"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5 p-6">
              <div>
                <h3 className="text-base font-bold text-chime-text">
                  Join a Cluster
                </h3>

                <p className="mt-1 text-sm leading-5 text-chime-secondary">
                  Use an invite code or discover a public community.
                </p>
              </div>

              <section className="rounded-xl border border-stone-200 bg-chime-chat p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-selected text-chime-text">
                    <Lock size={18} />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-chime-text">
                      Have an invite?
                    </h4>

                    <p className="mt-1 text-xs leading-5 text-chime-secondary">
                      Enter the code shared by a Cluster owner or member.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleJoin} className="mt-5">
                  <label
                    htmlFor="cluster-invite-code"
                    className="mb-2 block text-sm font-semibold text-chime-text"
                  >
                    Invite code
                  </label>

                  <div className="flex gap-2.5">
                    <input
                      id="cluster-invite-code"
                      type="text"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      placeholder="Enter invite code"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-chime-background px-4 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/10"
                      disabled={joining}
                      autoFocus
                    />

                    <button
                      type="submit"
                      disabled={joining}
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-chime-gold px-5 text-sm font-bold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {joining ? "Joining..." : "Join"}
                      {!joining && <ArrowRight size={16} />}
                    </button>
                  </div>
                </form>
              </section>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-chime-secondary">
                  Or
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>

              <section className="rounded-xl border border-stone-200 bg-chime-background p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chime-gold text-chime-text">
                    <Compass size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-chime-text">
                      Discover public Clusters
                    </h4>

                    <p className="mt-1 text-xs leading-5 text-chime-secondary">
                      Browse public communities and find conversations that
                      interest you.
                    </p>

                    <button
                      type="button"
                      onClick={handleDiscover}
                      disabled={isBusy}
                      className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-chime-chat px-4 text-sm font-semibold text-chime-text transition hover:border-chime-gold hover:bg-chime-selected disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Discover Clusters
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </section>

              <div className="flex items-start gap-2.5 rounded-xl bg-chime-chat px-4 py-3">
                <Users
                  size={16}
                  className="mt-0.5 shrink-0 text-chime-secondary"
                />

                <p className="text-xs leading-5 text-chime-secondary">
                  Public Clusters can be discovered by everyone. Private
                  Clusters require an invite code.
                </p>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">
                  {error}
                </p>
              )}

              <div className="flex justify-end border-t border-stone-200 pt-5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={joining}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateClusterModal;
