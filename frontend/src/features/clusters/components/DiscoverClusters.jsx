import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Compass,
  Globe,
  LogIn,
  Search,
  Users,
  X,
} from "lucide-react";
import { authFetch } from "../../../shared/utils/authFetch";

function DiscoverClusters({ onSelectCluster, onBack }) {
  const [clusters, setClusters] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState("");

  const fetchClusters = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/clusters/public",
      );

      if (!response.ok) {
        throw new Error("Failed to load Clusters.");
      }

      const data = await response.json();
      setClusters(data.clusters || []);
    } catch (error) {
      console.error("Failed to fetch public Clusters:", error);
      setError("Failed to load Clusters.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await authFetch(
        "http://localhost:5000/api/clusters/requests/mine",
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setPendingRequests(data.requests || []);
    } catch (error) {
      console.error("Failed to fetch Cluster requests:", error);
    }
  };

  useEffect(() => {
    fetchClusters();
    fetchPendingRequests();
  }, []);

  const handleJoin = async (cluster) => {
    if (!cluster?._id || joiningId) {
      return;
    }

    setJoiningId(cluster._id);
    setError("");

    try {
      const response = await authFetch(
        `http://localhost:5000/api/clusters/${cluster._id}/join`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to join Cluster.");
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.filter(
          (currentCluster) => currentCluster._id !== cluster._id,
        ),
      );

      if (onSelectCluster) {
        onSelectCluster({
          ...cluster,
          memberCount: (cluster.memberCount || 0) + 1,
        });
      }
    } catch (error) {
      console.error("Failed to join Cluster:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setJoiningId(null);
    }
  };

  const isPending = (clusterId) => {
    return pendingRequests.some(
      (request) => String(request.cluster?._id) === String(clusterId),
    );
  };

  const filteredClusters = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return clusters;
    }

    return clusters.filter((cluster) => {
      const name = cluster.name?.toLowerCase() || "";
      const description = cluster.description?.toLowerCase() || "";

      return name.includes(query) || description.includes(query);
    });
  }, [clusters, search]);

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-chime-background">
      <header className="shrink-0 border-b border-stone-200">
        <div className="mx-auto w-full max-w-6xl px-6 py-7 lg:px-8">
          <div className="flex flex-col gap-7">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={onBack}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
                aria-label="Back"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chime-gold text-chime-text shadow-sm">
                <Compass size={21} strokeWidth={2.2} />
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-chime-text">
                  Discover Clusters
                </h1>

                <p className="mt-1.5 max-w-2xl text-sm leading-5 text-chime-secondary">
                  Find communities that match your interests and join the
                  conversations you care about.
                </p>
              </div>
            </div>

            <div className="relative w-full max-w-3xl">
              <Search
                size={18}
                strokeWidth={2}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-chime-secondary"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search public Clusters..."
                className="w-full rounded-xl border border-stone-200 bg-chime-chat py-3.5 pl-11 pr-11 text-sm text-chime-text outline-none transition placeholder:text-chime-secondary focus:border-chime-gold focus:ring-2 focus:ring-chime-gold/10"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-chime-secondary transition hover:bg-chime-selected hover:text-chime-text"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-7 lg:px-8">
          {error && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoading(true);
                  fetchClusters();
                }}
                className="shrink-0 font-semibold hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-sm font-bold text-chime-text">
              Public Clusters
            </h2>

            <p className="mt-1 text-xs text-chime-secondary">
              {loading
                ? "Finding communities..."
                : search
                  ? `${filteredClusters.length} ${
                      filteredClusters.length === 1
                        ? "community"
                        : "communities"
                    } found`
                  : `${clusters.length} ${
                      clusters.length === 1 ? "community" : "communities"
                    } available`}
            </p>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[340px] animate-pulse rounded-2xl border border-stone-200 bg-chime-background p-5"
                >
                  <div className="flex justify-end">
                    <div className="h-6 w-16 rounded-full bg-chime-chat" />
                  </div>

                  <div className="mx-auto mt-5 h-20 w-20 rounded-2xl bg-chime-chat" />

                  <div className="mx-auto mt-4 h-4 w-32 rounded bg-chime-chat" />

                  <div className="mx-auto mt-3 h-3 w-44 rounded bg-chime-chat" />
                  <div className="mx-auto mt-2 h-3 w-36 rounded bg-chime-chat" />

                  <div className="mt-6 h-3 w-28 rounded bg-chime-chat" />
                  <div className="mt-4 h-10 w-full rounded-xl bg-chime-chat" />
                </div>
              ))}
            </div>
          ) : filteredClusters.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-chime-chat px-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-chime-selected text-chime-secondary">
                  {search ? <Search size={21} /> : <Globe size={21} />}
                </div>

                <h2 className="mt-4 text-base font-bold text-chime-text">
                  {search ? "No Clusters found" : "No public Clusters yet"}
                </h2>

                <p className="mt-1.5 text-sm leading-5 text-chime-secondary">
                  {search
                    ? `Nothing matches "${search}". Try a different search.`
                    : "Public communities will appear here when they're available."}
                </p>

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-4 rounded-lg px-3 py-1.5 text-sm font-semibold text-chime-text transition hover:bg-chime-selected"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClusters.map((cluster) => {
                const pending = isPending(cluster._id);
                const joining = joiningId === cluster._id;
                const initial =
                  cluster.name?.trim()?.charAt(0)?.toUpperCase() || "C";

                return (
                  <article
                    key={cluster._id}
                    className="group flex h-[340px] flex-col rounded-2xl border border-stone-200 bg-chime-background p-5 transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
                  >
                    <div className="flex justify-end">
                      <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-chime-chat px-2.5 py-1 text-[11px] font-semibold text-chime-secondary">
                        <Globe size={12} />
                        Public
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-chime-gold shadow-sm ring-4 ring-chime-chat">
                        {cluster.profilePicture ? (
                          <img
                            src={cluster.profilePicture}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-chime-text">
                            {initial}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <h3 className="truncate text-base font-bold text-chime-text">
                        {cluster.name || "Unnamed Cluster"}
                      </h3>

                      <div className="mt-2 h-[54px]">
                        {cluster.description?.trim() && (
                          <p className="line-clamp-3 text-sm leading-[18px] text-chime-secondary">
                            {cluster.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-chime-secondary">
                          <Users size={14} />
                          <span>
                            {cluster.memberCount || 0}{" "}
                            {cluster.memberCount === 1 ? "member" : "members"}
                          </span>
                        </div>

                        <span className="text-[11px] font-medium uppercase tracking-wide text-chime-secondary/70">
                          Open community
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleJoin(cluster)}
                        disabled={joining || pending}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-chime-gold px-4 py-2.5 text-sm font-bold text-chime-text shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LogIn size={16} />

                        {joining
                          ? "Joining..."
                          : pending
                            ? "Request Pending"
                            : "Join Cluster"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default DiscoverClusters;
