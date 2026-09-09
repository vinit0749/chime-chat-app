import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

function useSidebarSocket({
  user,
  blockedUserIds,
  blockedByUserIds,
  fetchCurrentUser,
  fetchRequests,
  fetchClusters,
  setUser,
  setFriends,
  setConversations,
  setRequests,
  setPresence,
  setBlockedUserIds,
  setBlockedByUserIds,
  setDmMenu,
  setClusterMenu,
  setClusters,
  onClusterUpdated,
  onClusterJoined,
  onClusterMemberJoined,
  onClusterDeleted,
  activeView,
}) {
  const blockedUserIdsRef = useRef(blockedUserIds);
  const blockedByUserIdsRef = useRef(blockedByUserIds);
  const activeViewRef = useRef(activeView);

  const fetchCurrentUserRef = useRef(fetchCurrentUser);
  const fetchRequestsRef = useRef(fetchRequests);
  const fetchClustersRef = useRef(fetchClusters);
  const onClusterUpdatedRef = useRef(onClusterUpdated);
  const onClusterJoinedRef = useRef(onClusterJoined);
  const onClusterMemberJoinedRef = useRef(onClusterMemberJoined);
  const onClusterDeletedRef = useRef(onClusterDeleted);

  useEffect(() => {
    blockedUserIdsRef.current = blockedUserIds;
  }, [blockedUserIds]);

  useEffect(() => {
    blockedByUserIdsRef.current = blockedByUserIds;
  }, [blockedByUserIds]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    fetchCurrentUserRef.current = fetchCurrentUser;
  }, [fetchCurrentUser]);

  useEffect(() => {
    fetchRequestsRef.current = fetchRequests;
  }, [fetchRequests]);

  useEffect(() => {
    fetchClustersRef.current = fetchClusters;
  }, [fetchClusters]);

  useEffect(() => {
    onClusterUpdatedRef.current = onClusterUpdated;
  }, [onClusterUpdated]);

  useEffect(() => {
    onClusterJoinedRef.current = onClusterJoined;
  }, [onClusterJoined]);

  useEffect(() => {
    onClusterMemberJoinedRef.current = onClusterMemberJoined;
  }, [onClusterMemberJoined]);

  useEffect(() => {
    onClusterDeletedRef.current = onClusterDeleted;
  }, [onClusterDeleted]);

  const userId = user?._id ? String(user._id) : null;

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !userId) {
      return;
    }

    const socket = io(import.meta.env.VITE_BACKEND_URL, {
      transports: ["websocket"],
      auth: {
        token,
      },
    });

    socket.on("presence_update", (data) => {
      if (!data?.userId) {
        return;
      }

      const targetUserId = String(data.userId);

      setBlockedUserIds((currentBlockedIds) => {
        if (!currentBlockedIds.has(targetUserId)) {
          return currentBlockedIds;
        }

        setPresence((currentPresence) => ({
          ...currentPresence,
          [targetUserId]: "offline",
        }));

        return currentBlockedIds;
      });

      setBlockedByUserIds((currentBlockedByIds) => {
        if (currentBlockedByIds.has(targetUserId)) {
          setPresence((currentPresence) => ({
            ...currentPresence,
            [targetUserId]: "offline",
          }));

          return currentBlockedByIds;
        }

        setPresence((currentPresence) => ({
          ...currentPresence,
          [targetUserId]: data.status,
        }));

        return currentBlockedByIds;
      });
    });

    socket.on("presence_initial", (users) => {
      if (!Array.isArray(users)) {
        return;
      }

      setPresence((currentPresence) => {
        const nextPresence = { ...currentPresence };

        users.forEach((item) => {
          if (!item?.userId) {
            return;
          }

          const targetUserId = String(item.userId);

          if (
            blockedUserIdsRef.current.has(targetUserId) ||
            blockedByUserIdsRef.current.has(targetUserId)
          ) {
            nextPresence[targetUserId] = "offline";
            return;
          }

          nextPresence[targetUserId] = item.status;
        });

        return nextPresence;
      });
    });

    socket.on("new_cluster_message", (data) => {
      const clusterId = String(data?.clusterId || data?.message?.cluster || "");

      if (!clusterId) {
        return;
      }

      const message = data?.message || data;
      const senderId = String(message?.sender?._id || message?.sender || "");

      if (!senderId || senderId === String(userId)) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.map((cluster) => {
          if (String(cluster._id) !== clusterId) {
            return cluster;
          }

          if (activeViewRef.current === `cluster-${clusterId}`) {
            return {
              ...cluster,
              unreadCount: 0,
            };
          }

          return {
            ...cluster,
            unreadCount: Math.max(0, (cluster.unreadCount || 0) + 1),
          };
        }),
      );
    });

    socket.on("cluster_message_received", (data) => {
      const clusterId = String(data?.clusterId || data?.message?.cluster || "");

      if (!clusterId) {
        return;
      }

      const message = data?.message || data;
      const senderId = String(message?.sender?._id || message?.sender || "");

      if (!senderId || senderId === String(userId)) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.map((cluster) => {
          if (String(cluster._id) !== clusterId) {
            return cluster;
          }

          if (activeViewRef.current === `cluster-${clusterId}`) {
            return {
              ...cluster,
              unreadCount: 0,
            };
          }

          return {
            ...cluster,
            unreadCount: Math.max(0, (cluster.unreadCount || 0) + 1),
          };
        }),
      );
    });

    socket.on("new_message", (data) => {
      if (!data) {
        return;
      }

      const message = data.message || data;
      const sender = message.sender || data.sender;

      if (!sender?._id) {
        return;
      }

      const senderId = String(sender._id);
      const currentUserId = String(userId);
      const isOwnMessage = senderId === currentUserId;

      const otherUser = isOwnMessage
        ? message.recipient || data.recipient
        : sender;

      if (!otherUser?._id) {
        return;
      }

      const otherUserId = String(otherUser._id);

      if (
        blockedUserIdsRef.current.has(otherUserId) ||
        blockedByUserIdsRef.current.has(otherUserId)
      ) {
        return;
      }

      setConversations((currentConversations) => {
        const existingIndex = currentConversations.findIndex(
          (conversation) => String(conversation?._id) === otherUserId,
        );

        const updatedConversation = {
          ...(existingIndex === -1 ? {} : currentConversations[existingIndex]),
          _id: otherUser._id,
          username:
            otherUser.username ||
            (existingIndex === -1
              ? ""
              : currentConversations[existingIndex].username),
          displayName:
            otherUser.displayName ||
            (existingIndex === -1
              ? ""
              : currentConversations[existingIndex].displayName),
          email:
            otherUser.email ||
            (existingIndex === -1
              ? ""
              : currentConversations[existingIndex].email),
          profilePicture:
            otherUser.profilePicture ||
            (existingIndex === -1
              ? ""
              : currentConversations[existingIndex].profilePicture || ""),
          unreadCount: isOwnMessage
            ? existingIndex === -1
              ? 0
              : currentConversations[existingIndex].unreadCount || 0
            : existingIndex === -1
              ? 1
              : (currentConversations[existingIndex].unreadCount || 0) + 1,
          isPinned:
            existingIndex === -1
              ? false
              : currentConversations[existingIndex].isPinned || false,
          lastMessageAt:
            message.createdAt || message.updatedAt || new Date().toISOString(),
        };

        const nextConversations = currentConversations.filter(
          (_, index) => index !== existingIndex,
        );

        return [updatedConversation, ...nextConversations];
      });
    });

    socket.on("conversation_read", (data) => {
      const otherUserId = data?.otherUserId;

      if (!otherUserId) {
        return;
      }

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          String(conversation._id) === String(otherUserId)
            ? {
                ...conversation,
                unreadCount: 0,
              }
            : conversation,
        ),
      );
    });

    socket.on("user_profile_updated", (data) => {
      const updatedUser = data?.user || data;

      if (!updatedUser?._id) {
        return;
      }

      const updatedUserId = String(updatedUser._id);

      if (updatedUserId === String(userId)) {
        setUser((currentUser) => {
          if (!currentUser) {
            return currentUser;
          }

          const nextUser = {
            ...currentUser,
            username: updatedUser.username ?? currentUser.username,
            displayName: updatedUser.displayName ?? currentUser.displayName,
            bio: updatedUser.bio ?? currentUser.bio,
            profilePicture:
              updatedUser.profilePicture ?? currentUser.profilePicture,
            status: updatedUser.status ?? currentUser.status,
          };

          localStorage.setItem("user", JSON.stringify(nextUser));

          return nextUser;
        });
      }

      setFriends((currentFriends) =>
        currentFriends.map((friend) =>
          String(friend?._id) === updatedUserId
            ? {
                ...friend,
                username: updatedUser.username ?? friend.username,
                displayName: updatedUser.displayName ?? friend.displayName,
                profilePicture:
                  updatedUser.profilePicture ?? friend.profilePicture ?? "",
                status: updatedUser.status ?? friend.status,
              }
            : friend,
        ),
      );

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          String(conversation?._id) === updatedUserId
            ? {
                ...conversation,
                username: updatedUser.username ?? conversation.username,
                displayName:
                  updatedUser.displayName ?? conversation.displayName,
                profilePicture:
                  updatedUser.profilePicture ??
                  conversation.profilePicture ??
                  "",
              }
            : conversation,
        ),
      );

      setRequests((currentRequests) =>
        currentRequests.map((request) => {
          const requesterId = String(
            request?.requester?._id || request?.requester || "",
          );

          const recipientId = String(
            request?.recipient?._id || request?.recipient || "",
          );

          if (requesterId === updatedUserId && request.requester) {
            return {
              ...request,
              requester:
                typeof request.requester === "object"
                  ? {
                      ...request.requester,
                      username:
                        updatedUser.username ?? request.requester.username,
                      displayName:
                        updatedUser.displayName ??
                        request.requester.displayName,
                      profilePicture:
                        updatedUser.profilePicture ??
                        request.requester.profilePicture ??
                        "",
                    }
                  : request.requester,
            };
          }

          if (recipientId === updatedUserId && request.recipient) {
            return {
              ...request,
              recipient:
                typeof request.recipient === "object"
                  ? {
                      ...request.recipient,
                      username:
                        updatedUser.username ?? request.recipient.username,
                      displayName:
                        updatedUser.displayName ??
                        request.recipient.displayName,
                      profilePicture:
                        updatedUser.profilePicture ??
                        request.recipient.profilePicture ??
                        "",
                    }
                  : request.recipient,
            };
          }

          return request;
        }),
      );
    });

    socket.on("friend_request_sent", (data) => {
      const sentUser = data?.user || data;
      const sentUserId = String(sentUser?._id || sentUser || "");

      if (!sentUserId) {
        return;
      }

      setRequests((currentRequests) =>
        currentRequests.filter((request) => {
          const requesterId = String(
            request?.requester?._id || request.requester || "",
          );
          const recipientId = String(
            request?.recipient?._id || request.recipient || "",
          );

          return requesterId !== sentUserId && recipientId !== sentUserId;
        }),
      );
    });

    socket.on("friend_request_received", (data) => {
      if (!data) {
        return;
      }

      const request = data.request || data;

      if (!request?._id && !request?.requester) {
        fetchRequestsRef.current?.();
        return;
      }

      setRequests((currentRequests) => {
        const requestId = String(
          request._id || request.requester?._id || request.requester || "",
        );

        const alreadyExists = currentRequests.some(
          (item) =>
            String(item._id || item.requester?._id || item.requester || "") ===
            requestId,
        );

        if (alreadyExists) {
          return currentRequests;
        }

        return [...currentRequests, request];
      });
    });

    socket.on("friend_request_accepted", (data) => {
      if (!data) {
        return;
      }

      const friend = data.friend || data.user;

      if (friend?._id) {
        setFriends((currentFriends) => {
          const exists = currentFriends.some(
            (item) => String(item._id) === String(friend._id),
          );

          if (exists) {
            return currentFriends;
          }

          return [...currentFriends, friend];
        });
      }

      setRequests((currentRequests) =>
        currentRequests.filter((request) => {
          const requesterId = String(
            request.requester?._id || request.requester || "",
          );

          const recipientId = String(
            request.recipient?._id || request.recipient || "",
          );

          const acceptedUserId = String(data.userId || friend?._id || "");

          return (
            requesterId !== acceptedUserId && recipientId !== acceptedUserId
          );
        }),
      );
    });

    socket.on("friend_request_rejected", (data) => {
      if (!data) {
        return;
      }

      const rejectedUserId = String(
        data.userId || data.requesterId || data.recipientId || "",
      );

      if (!rejectedUserId) {
        fetchRequestsRef.current?.();
        return;
      }

      setRequests((currentRequests) =>
        currentRequests.filter((request) => {
          const requesterId = String(
            request.requester?._id || request.requester || "",
          );

          const recipientId = String(
            request.recipient?._id || request.recipient || "",
          );

          return (
            requesterId !== rejectedUserId && recipientId !== rejectedUserId
          );
        }),
      );
    });

    socket.on("friend_removed", (data) => {
      if (!data) {
        return;
      }

      const removedUserId = String(
        data.userId || data.friendId || data.removedUserId || "",
      );

      if (!removedUserId) {
        fetchCurrentUserRef.current?.();
        return;
      }

      setFriends((currentFriends) =>
        currentFriends.filter((friend) => String(friend._id) !== removedUserId),
      );
    });

    socket.on("user_blocked", (data) => {
      if (!data) {
        return;
      }

      const blockedId = String(
        data.userId || data.blockedUserId || data.targetUserId || "",
      );

      if (!blockedId) {
        fetchCurrentUserRef.current?.();
        return;
      }

      setBlockedUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(blockedId);
        return nextIds;
      });

      setUser((currentUser) => {
        if (!currentUser) {
          return currentUser;
        }

        const existingBlocked = (currentUser.blockedUsers || [])
          .map((blockedUser) => blockedUser?._id || blockedUser)
          .map(String);

        const nextBlockedUsers = existingBlocked.includes(blockedId)
          ? existingBlocked
          : [...existingBlocked, blockedId];

        const nextUser = {
          ...currentUser,
          blockedUsers: nextBlockedUsers,
        };

        localStorage.setItem("user", JSON.stringify(nextUser));

        return nextUser;
      });

      setPresence((currentPresence) => ({
        ...currentPresence,
        [blockedId]: "offline",
      }));

      setFriends((currentFriends) =>
        currentFriends.filter((friend) => String(friend._id) !== blockedId),
      );

      setDmMenu((currentMenu) => {
        if (String(currentMenu.user?._id) === blockedId) {
          return {
            isOpen: false,
            user: null,
          };
        }

        return currentMenu;
      });
    });

    socket.on("user_blocked_by_other", (data) => {
      if (!data) {
        return;
      }

      const blockerId = String(
        data.userId || data.blockerId || data.blockedByUserId || "",
      );

      if (!blockerId) {
        return;
      }

      setBlockedByUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(blockerId);
        return nextIds;
      });

      setFriends((currentFriends) =>
        currentFriends.filter((friend) => String(friend._id) !== blockerId),
      );

      setPresence((currentPresence) => ({
        ...currentPresence,
        [blockerId]: "offline",
      }));

      setDmMenu((currentMenu) => {
        if (String(currentMenu.user?._id) === blockerId) {
          return {
            isOpen: false,
            user: null,
          };
        }

        return currentMenu;
      });
    });

    socket.on("user_unblocked", (data) => {
      if (!data) {
        return;
      }

      const unblockedId = String(
        data.userId || data.unblockedUserId || data.targetUserId || "",
      );

      if (!unblockedId) {
        fetchCurrentUserRef.current?.();
        return;
      }

      setBlockedUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(unblockedId);
        return nextIds;
      });

      setBlockedByUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(unblockedId);
        return nextIds;
      });

      setPresence((currentPresence) => {
        const nextPresence = { ...currentPresence };
        delete nextPresence[unblockedId];
        return nextPresence;
      });
    });

    socket.on("user_deleted", (data) => {
      const deletedUserId = String(data?.userId || "");

      if (!deletedUserId) {
        return;
      }

      setConversations((currentConversations) =>
        currentConversations.filter(
          (conversation) => String(conversation?._id) !== deletedUserId,
        ),
      );

      setFriends((currentFriends) =>
        currentFriends.filter(
          (friend) => String(friend?._id) !== deletedUserId,
        ),
      );

      setRequests((currentRequests) =>
        currentRequests.filter((request) => {
          const requesterId = String(
            request?.requester?._id || request?.requester || "",
          );

          const recipientId = String(
            request?.recipient?._id || request?.recipient || "",
          );

          return requesterId !== deletedUserId && recipientId !== deletedUserId;
        }),
      );

      setBlockedUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(deletedUserId);
        return nextIds;
      });

      setBlockedByUserIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(deletedUserId);
        return nextIds;
      });

      setPresence((currentPresence) => {
        const nextPresence = { ...currentPresence };
        delete nextPresence[deletedUserId];
        return nextPresence;
      });

      setDmMenu((currentMenu) => {
        if (String(currentMenu.user?._id) === deletedUserId) {
          return {
            isOpen: false,
            user: null,
          };
        }

        return currentMenu;
      });
    });

    socket.on("cluster_created", (data) => {
      const cluster = data?.cluster || data;

      if (!cluster?._id) {
        fetchClustersRef.current?.();
        return;
      }

      setClusters((currentClusters) => {
        const exists = currentClusters.some(
          (item) => String(item._id) === String(cluster._id),
        );

        if (exists) {
          return currentClusters;
        }

        return [
          ...currentClusters,
          {
            ...cluster,
            isPinned: false,
          },
        ];
      });
    });

    socket.on("cluster_joined", (data) => {
      const cluster = data?.cluster;

      if (cluster?._id) {
        setClusters((currentClusters) => {
          const exists = currentClusters.some(
            (item) => String(item._id) === String(cluster._id),
          );

          if (exists) {
            return currentClusters;
          }

          return [
            ...currentClusters,
            {
              ...cluster,
              isPinned: false,
            },
          ];
        });

        return;
      }

      fetchClustersRef.current?.();
    });

    socket.on("cluster_joined_realtime", (data) => {
      const cluster = data?.cluster || data;

      if (!cluster?._id) {
        return;
      }

      setClusters((currentClusters) => {
        const existingIndex = currentClusters.findIndex(
          (item) => String(item._id) === String(cluster._id),
        );

        if (existingIndex === -1) {
          return [
            ...currentClusters,
            {
              ...cluster,
              isPinned: false,
            },
          ];
        }

        return currentClusters.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                ...cluster,
              }
            : item,
        );
      });

      onClusterJoinedRef.current?.(cluster);
    });

    socket.on("cluster_member_joined", (data) => {
      const clusterId = String(data?.clusterId || data?.cluster?._id || "");

      if (!clusterId) {
        return;
      }

      const member = data?.member || data?.clusterMember;
      const cluster = data?.cluster;

      if (cluster?._id) {
        setClusters((currentClusters) =>
          currentClusters.map((currentCluster) =>
            String(currentCluster._id) === String(cluster._id)
              ? {
                  ...currentCluster,
                  ...cluster,
                  unreadCount:
                    activeViewRef.current === `cluster-${cluster._id}`
                      ? 0
                      : currentCluster.unreadCount,
                }
              : currentCluster,
          ),
        );
      } else if (member) {
        setClusters((currentClusters) =>
          currentClusters.map((currentCluster) => {
            if (String(currentCluster._id) !== clusterId) {
              return currentCluster;
            }

            const currentMemberCount = Number(
              currentCluster.memberCount ??
                currentCluster.membersCount ??
                currentCluster.members?.length ??
                0,
            );

            return {
              ...currentCluster,
              memberCount: currentMemberCount + 1,
            };
          }),
        );
      }

      onClusterMemberJoinedRef.current?.({
        clusterId,
        member,
        cluster: cluster || null,
      });
    });

    socket.on("cluster_left", (data) => {
      const clusterId = String(data?.clusterId || data?.cluster?._id || "");

      if (!clusterId) {
        fetchClustersRef.current?.();
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.filter((cluster) => String(cluster._id) !== clusterId),
      );

      setClusterMenu((currentMenu) => {
        if (String(currentMenu.cluster?._id) === clusterId) {
          return {
            isOpen: false,
            cluster: null,
          };
        }

        return currentMenu;
      });
    });

    socket.on("cluster_updated", (data) => {
      const updatedCluster = data?.cluster || data;

      if (!updatedCluster?._id) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.map((cluster) =>
          String(cluster._id) === String(updatedCluster._id)
            ? {
                ...cluster,
                ...updatedCluster,
              }
            : cluster,
        ),
      );

      setClusterMenu((currentMenu) => {
        if (String(currentMenu.cluster?._id) !== String(updatedCluster._id)) {
          return currentMenu;
        }

        return {
          ...currentMenu,
          cluster: {
            ...currentMenu.cluster,
            ...updatedCluster,
          },
        };
      });

      onClusterUpdatedRef.current?.(updatedCluster);
    });

    socket.on("cluster_ownership_transferred", (data) => {
      const cluster = data?.cluster;

      if (!cluster?._id) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.map((currentCluster) =>
          String(currentCluster._id) === String(cluster._id)
            ? {
                ...currentCluster,
                ...cluster,
                unreadCount:
                  activeViewRef.current === `cluster-${cluster._id}`
                    ? 0
                    : currentCluster.unreadCount,
              }
            : currentCluster,
        ),
      );

      setClusterMenu((currentMenu) => {
        if (String(currentMenu.cluster?._id) !== String(cluster._id)) {
          return currentMenu;
        }

        return {
          ...currentMenu,
          cluster: {
            ...currentMenu.cluster,
            ...cluster,
          },
        };
      });

      onClusterUpdatedRef.current?.(cluster);
    });

    socket.on("cluster_member_updated", (data) => {
      const clusterId = String(data?.clusterId || "");

      if (!clusterId) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.map((cluster) => {
          if (String(cluster._id) !== clusterId) {
            return cluster;
          }

          return {
            ...cluster,
            memberCount:
              typeof data.memberCount === "number"
                ? data.memberCount
                : Math.max(0, (cluster.memberCount || 1) - 1),
          };
        }),
      );
    });

    socket.on("cluster_member_kicked", (data) => {
      const clusterId = String(data?.clusterId || "");
      const kickedUserId = String(data?.userId || "");

      if (!clusterId || !kickedUserId) {
        return;
      }

      if (String(userId) === kickedUserId) {
        setClusters((currentClusters) =>
          currentClusters.filter(
            (cluster) => String(cluster._id) !== clusterId,
          ),
        );

        setClusterMenu((currentMenu) => {
          if (String(currentMenu.cluster?._id) === clusterId) {
            return {
              isOpen: false,
              cluster: null,
            };
          }

          return currentMenu;
        });

        return;
      }

      setClusters((currentClusters) =>
        currentClusters.map((cluster) => {
          if (String(cluster._id) !== clusterId) {
            return cluster;
          }

          return {
            ...cluster,
            memberCount: Math.max(0, (cluster.memberCount || 1) - 1),
          };
        }),
      );
    });

    socket.on("cluster_kicked", (data) => {
      const clusterId = String(data?.clusterId || "");

      if (!clusterId) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.filter((cluster) => String(cluster._id) !== clusterId),
      );

      setClusterMenu((currentMenu) => {
        if (String(currentMenu.cluster?._id) === clusterId) {
          return {
            isOpen: false,
            cluster: null,
          };
        }

        return currentMenu;
      });
    });

    socket.on("cluster_deleted", (data) => {
      const clusterId = String(data?.clusterId || "");

      if (!clusterId) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.filter((cluster) => String(cluster._id) !== clusterId),
      );

      setClusterMenu((currentMenu) => {
        if (String(currentMenu.cluster?._id) === clusterId) {
          return {
            isOpen: false,
            cluster: null,
          };
        }

        return currentMenu;
      });

      onClusterDeletedRef.current?.(clusterId);
    });

    socket.on("cluster_chat_wiped", (data) => {
      const clusterId = String(data?.clusterId || "");

      if (!clusterId) {
        return;
      }

      setClusters((currentClusters) =>
        currentClusters.map((cluster) =>
          String(cluster._id) === clusterId
            ? {
                ...cluster,
                unreadCount: 0,
              }
            : cluster,
        ),
      );
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [
    userId,
    setUser,
    setFriends,
    setConversations,
    setRequests,
    setPresence,
    setBlockedUserIds,
    setBlockedByUserIds,
    setDmMenu,
    setClusterMenu,
    setClusters,
  ]);
}

export default useSidebarSocket;
