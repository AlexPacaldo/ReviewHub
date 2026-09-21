import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useNotifications } from "../contexts/NotificationContext.jsx";
import { acceptFriendRequest, listFriendships, removeFriendship } from "../services/social.js";
import { listVisibleCloudReviewers } from "../services/cloudReviewers.js";
import { saveCloudReviewerCache, SOCIAL_DATA_CHANGED_EVENT } from "../utils/storageUtils.js";
import { supabase } from "../lib/supabaseClient.js";

const STATE_KEY = "hachi_social_notification_state";
const POLL_INTERVAL_MS = 60_000;
const MAX_SEEN = 300;

function getFriendName(profile) {
  return profile?.display_name || profile?.email || "A friend";
}

function readState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadUserState(userId) {
  const all = readState();
  const current = all[userId] && typeof all[userId] === "object" ? all[userId] : {};
  return {
    seeded: Boolean(current.seeded),
    incomingSeen: Array.isArray(current.incomingSeen) ? current.incomingSeen : [],
    acceptedSeen: Array.isArray(current.acceptedSeen) ? current.acceptedSeen : [],
    sharedSeen: Array.isArray(current.sharedSeen) ? current.sharedSeen : []
  };
}

function saveUserState(userId, state) {
  try {
    const all = readState();
    all[userId] = {
      seeded: Boolean(state.seeded),
      incomingSeen: state.incomingSeen.slice(0, MAX_SEEN),
      acceptedSeen: state.acceptedSeen.slice(0, MAX_SEEN),
      sharedSeen: state.sharedSeen.slice(0, MAX_SEEN)
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(all));
  } catch {
    // Best-effort persistence; a failed write just means one-time re-notification risk.
  }
}

export default function SocialNotificationWatcher() {
  const { configured, loading, user } = useAuth();
  const { notify, registerAction } = useNotifications();
  const inFlight = useRef(false);

  useEffect(() => {
    if (loading || !configured || !user) return undefined;

    const unregisterAccept = registerAction("friend-request-accept", async (payload) => {
      const { error } = await acceptFriendRequest(payload.friendshipId);
      if (error) throw error;
      notify({
        type: "success",
        title: "Friend request accepted",
        message: `You and ${payload.friendName} are now friends.`
      });
    });

    const unregisterDecline = registerAction("friend-request-decline", async (payload) => {
      const { error } = await removeFriendship(payload.friendshipId);
      if (error) throw error;
      notify({
        type: "info",
        title: "Friend request declined",
        message: `You declined ${payload.friendName}'s friend request.`
      });
    });

    const runPoll = async () => {
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        const [friendshipsResult, visibleResult] = await Promise.all([
          listFriendships(user.id),
          listVisibleCloudReviewers(user.id)
        ]);

        if (friendshipsResult.error || visibleResult.error) return;

        const friendships = friendshipsResult.data || [];
        const incomingPending = friendships.filter(
          (friendship) => friendship.addressee_id === user.id && friendship.status === "pending"
        );
        const acceptedByFriends = friendships.filter(
          (friendship) => friendship.requester_id === user.id && friendship.status === "accepted"
        );
        const friendReviewers = (visibleResult.data || []).filter(
          (row) => row.owner_id !== user.id
        );

        const cachedReviewers = (visibleResult.data || []).map((item) => {
          const reviewerData = item.data || item;
          return {
            ...reviewerData,
            ownerId: item.owner_id,
            ...(item.ownerName ? { ownerName: item.ownerName } : {}),
            visibility: item.visibility || reviewerData.visibility || "friends",
            sharedWith: Array.isArray(item.shared_with) ? item.shared_with : reviewerData.sharedWith || null
          };
        });
        saveCloudReviewerCache(cachedReviewers);

        const state = loadUserState(user.id);
        const incomingSeen = new Set(state.incomingSeen);
        const acceptedSeen = new Set(state.acceptedSeen);
        const sharedSeen = new Set(state.sharedSeen);

        if (state.seeded) {
          incomingPending.forEach((friendship) => {
            if (incomingSeen.has(friendship.id)) return;
            incomingSeen.add(friendship.id);
            const friendName = getFriendName(friendship.otherProfile);
            notify({
              type: "info",
              title: "New friend request",
              message: `${friendName} sent you a friend request.`,
              actions: [
                { label: "Accept", kind: "friend-request-accept", variant: "primary", payload: { friendshipId: friendship.id, friendName } },
                { label: "Decline", kind: "friend-request-decline", variant: "subtle", payload: { friendshipId: friendship.id, friendName } }
              ]
            });
          });

          acceptedByFriends.forEach((friendship) => {
            if (acceptedSeen.has(friendship.id)) return;
            acceptedSeen.add(friendship.id);
            notify({
              type: "success",
              title: "Friend request accepted",
              message: `${getFriendName(friendship.otherProfile)} accepted your friend request.`,
              actionLabel: "View friends",
              actionHref: "/friends"
            });
          });

          friendReviewers.forEach((row) => {
            if (sharedSeen.has(row.reviewer_id)) return;
            sharedSeen.add(row.reviewer_id);
            const ownerName = row.ownerName || getFriendName(row.ownerProfile);
            const reviewerTitle = row.data?.title || row.title || "a reviewer";
            notify({
              type: "success",
              title: "New reviewer shared with you",
              message: `${ownerName} shared "${reviewerTitle}".`,
              actionLabel: "Open reviewer",
              actionHref: `/reviewer/${row.reviewer_id}`
            });
          });
        } else {
          incomingPending.forEach((friendship) => incomingSeen.add(friendship.id));
          acceptedByFriends.forEach((friendship) => acceptedSeen.add(friendship.id));
          friendReviewers.forEach((row) => sharedSeen.add(row.reviewer_id));
        }

        const currentFriendReviewerIds = new Set(friendReviewers.map((row) => row.reviewer_id));
        saveUserState(user.id, {
          seeded: true,
          incomingSeen: [...incomingSeen],
          acceptedSeen: [...acceptedSeen],
          sharedSeen: [...sharedSeen].filter((reviewerId) => currentFriendReviewerIds.has(reviewerId))
        });
      } finally {
        inFlight.current = false;
      }
    };

    runPoll();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") runPoll();
    }, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") runPoll();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleRealtimeChange = () => {
      runPoll();
      window.dispatchEvent(new Event(SOCIAL_DATA_CHANGED_EVENT));
    };

    const channel = supabase
      ? supabase
          .channel(`social-watcher-${user.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, handleRealtimeChange)
          .on("postgres_changes", { event: "*", schema: "public", table: "reviewer_shares" }, handleRealtimeChange)
          .on("postgres_changes", { event: "*", schema: "public", table: "reviewers" }, handleRealtimeChange)
          .subscribe()
      : null;

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) supabase.removeChannel(channel);
      unregisterAccept();
      unregisterDecline();
    };
  }, [configured, loading, registerAction, user?.id, notify]);

  return null;
}