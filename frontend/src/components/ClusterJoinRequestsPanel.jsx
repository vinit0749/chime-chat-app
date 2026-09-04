import { useEffect, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { authFetch } from "../utils/authFetch";

function ClusterJoinRequestsPanel({ cluster, socket }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cluster?._id) {
      return;
    }

    let cancelled = false;

    const fetchRequests = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await authFetch(
          `http://localhost:5000/api/clusters/${cluster._id}/requests`,
        );

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(data.message || "Failed to load join requests.");
          setRequests([]);
          return;
        }

        setRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch Cluster join requests:", error);
          setError("Something went wrong. Please try again.");
          setRequests([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRequests();

    return () => {
      cancelled = true;
    };
  }, [cluster?._id]);

  useEffect(() => {
    if (!socket || !cluster?._id) {
      return;
    }

    const handleJoinRequest = (data) => {
      if (String(data?.clusterId) !== String(cluster._id)) {
        return;
      }

      const request = data?.request;

      if (!request?.userId) {
        return;
      }

      setRequests((currentRequests) => {
        const exists = currentRequests.some(
          (currentRequest) =>
            String(
              currentRequest?.user?._id ||
                currentRequest?.userId ||
                currentRequest?._id,
            ) === String(request.userId),
        );

        if (exists) {
          return currentRequests;
        }

        return [...currentRequests, request];
      });
    };

    socket.on("cluster_join_request", handleJoinRequest);

    return () => {
      socket.off("cluster_join_request", handleJoinRequest);
    };
  }, [socket, cluster?._id]);

  const getRequestUser = (request) => {
    return request?.user || request?.userId;
  };

  const getUserId = (request) => {
    const user = getRequestUser(request);

    if (typeof user === "object") {
      return user?._id;
    }

    return user;
  };

  const getDisplayName = (request) => {
    const user = getRequestUser(request);

    if (typeof user === "object") {
      return user?.displayName || user?.username || "User";
    }

    return "User";
  };

  const getUsername = (request) => {
    const user = getRequestUser(request);

    if (typeof user === "object") {
      return user?.username || "user";
    }

    return "user";
  };

  const getProfilePicture = (request) => {
    const user = getRequestUser(request);

    if (typeof user === "object") {
      return user?.profilePicture || "";
    }

    return "";
  };

  const handleApprove = async (request) => {
    const userId = getUserId(request);

    if (!cluster?._id || !userId || actionUserId) {
      return;
    }

    setActionUserId(String(userId));
    setError("");

    try {
      const response = await authFetch(
        `http://localhost:5000/api/clusters/${cluster._id}/requests/${userId}/approve`,
        {
          method: "PATCH",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to approve join request.");
        return;
      }

      setRequests((currentRequests) =>
        currentRequests.filter(
          (currentRequest) =>
            String(getUserId(currentRequest)) !== String(userId),
        ),
      );
    } catch (error) {
      console.error("Failed to approve Cluster join request:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setActionUserId(null);
    }
  };

  const handleReject = async (request) => {
    const userId = getUserId(request);

    if (!cluster?._id || !userId || actionUserId) {
      return;
    }

    setActionUserId(String(userId));
    setError("");

    try {
      const response = await authFetch(
        `http://localhost:5000/api/clusters/${cluster._id}/requests/${userId}/reject`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to reject join request.");
        return;
      }

      setRequests((currentRequests) =>
        currentRequests.filter(
          (currentRequest) =>
            String(getUserId(currentRequest)) !== String(userId),
        ),
      );
    } catch (error) {
      console.error("Failed to reject Cluster join request:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <section className="border-b border-stone-200 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-chime-text">Join Requests</h3>

          {requests.length > 0 && (
            <span className="rounded-full bg-chime-gold px-1.5 py-0.5 text-[9px] font-bold text-chime-text">
              {requests.length}
            </span>
          )}
        </div>

        <Clock size={14} className="text-chime-secondary" />
      </div>

      {loading ? (
        <p className="px-1 py-1 text-[11px] text-chime-secondary">Loading...</p>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-600">
          {error}
        </p>
      ) : requests.length === 0 ? (
        <div className="rounded-lg bg-chime-chat px-3 py-2 text-center">
          <p className="text-[11px] text-chime-secondary">
            No pending requests
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {requests.map((request) => {
            const userId = getUserId(request);
            const displayName = getDisplayName(request);
            const username = getUsername(request);
            const profilePicture = getProfilePicture(request);
            const isActing = String(actionUserId) === String(userId);

            return (
              <div
                key={String(userId || request?._id)}
                className="rounded-lg border border-stone-200 bg-chime-chat px-2.5 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-chime-gold">
                    {profilePicture ? (
                      <img
                        src={profilePicture}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-chime-text">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-chime-text">
                      {displayName}
                    </p>

                    <p className="truncate text-[10px] text-chime-secondary">
                      @{username}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleReject(request)}
                      disabled={Boolean(actionUserId)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-chime-background text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Deny"
                    >
                      <X size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(request)}
                      disabled={Boolean(actionUserId)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-chime-gold text-chime-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      title={isActing ? "Processing..." : "Accept"}
                    >
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ClusterJoinRequestsPanel;
