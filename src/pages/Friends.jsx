import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Cloud, Download, Search, Send, Trash2, UserPlus, Users } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getAllReviewers } from "../data/reviewerRegistry.js";
import { upsertCloudReviewer } from "../services/cloudReviewers.js";
import {
  acceptFriendRequest,
  deleteReviewerShare,
  ensureMyProfile,
  listFriendships,
  listReceivedReviewerShares,
  removeFriendship,
  searchProfiles,
  sendFriendRequest,
  shareReviewer
} from "../services/social.js";
import { saveLocalReviewer } from "../utils/storageUtils.js";

function getProfileName(profile) {
  return profile?.display_name || profile?.email || "Hachi user";
}

function cloneSharedReviewer(reviewer) {
  const baseId = reviewer?.reviewerId || "shared-reviewer";

  return {
    ...reviewer,
    reviewerId: `${baseId}-shared-${Date.now()}`
  };
}

export default function Friends() {
  const { configured, loading, user } = useAuth();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [shares, setShares] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [message, setMessage] = useState(null);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const reviewers = useMemo(() => getAllReviewers().filter((reviewer) => reviewer.validation?.isValid), []);

  const acceptedFriends = friendships.filter((friendship) => friendship.status === "accepted");
  const incomingRequests = friendships.filter((friendship) => friendship.status === "pending" && friendship.addressee_id === user?.id);
  const outgoingRequests = friendships.filter((friendship) => friendship.status === "pending" && friendship.requester_id === user?.id);

  useEffect(() => {
    if (!configured || !user) return;
    refreshSocialData();
  }, [configured, user?.id]);

  async function refreshSocialData() {
    if (!user) return;

    setLoadingSocial(true);
    setMessage(null);
    await ensureMyProfile(user);

    const [friendshipsResult, sharesResult] = await Promise.all([
      listFriendships(user.id),
      listReceivedReviewerShares(user.id)
    ]);

    if (friendshipsResult.error) {
      setMessage({ type: "error", text: friendshipsResult.error.message || "Could not load friends." });
    } else {
      setFriendships(friendshipsResult.data || []);
    }

    if (sharesResult.error) {
      setMessage({ type: "error", text: sharesResult.error.message || "Could not load shared reviewers." });
    } else {
      setShares(sharesResult.data || []);
    }

    setLoadingSocial(false);
  }

  async function searchForFriends(event) {
    event.preventDefault();
    setMessage(null);

    if (!user) return;

    const { data, error } = await searchProfiles(query, user.id);
    if (error) {
      setMessage({ type: "error", text: error.message || "Could not search users." });
      return;
    }

    setSearchResults(data || []);
  }

  async function requestFriend(profile) {
    const { error } = await sendFriendRequest(user.id, profile.id);

    if (error) {
      setMessage({ type: "error", text: error.message || "Could not send friend request." });
      return;
    }

    setMessage({ type: "success", text: `Friend request sent to ${getProfileName(profile)}.` });
    setSearchResults([]);
    setQuery("");
    refreshSocialData();
  }

  async function acceptRequest(friendship) {
    const { error } = await acceptFriendRequest(friendship.id);

    if (error) {
      setMessage({ type: "error", text: error.message || "Could not accept request." });
      return;
    }

    setMessage({ type: "success", text: "Friend request accepted." });
    refreshSocialData();
  }

  async function removeConnection(friendship) {
    const confirmed = window.confirm("Remove this friend or request?");
    if (!confirmed) return;

    const { error } = await removeFriendship(friendship.id);

    if (error) {
      setMessage({ type: "error", text: error.message || "Could not remove connection." });
      return;
    }

    setMessage({ type: "success", text: "Connection removed." });
    refreshSocialData();
  }

  async function sendReviewerShare(event) {
    event.preventDefault();

    const reviewer = reviewers.find((item) => item.reviewerId === selectedReviewerId);

    if (!reviewer || !selectedFriendId) {
      setMessage({ type: "error", text: "Choose a reviewer and a friend first." });
      return;
    }

    const { error } = await shareReviewer(user.id, selectedFriendId, reviewer, shareMessage);

    if (error) {
      setMessage({ type: "error", text: error.message || "Could not share reviewer." });
      return;
    }

    setMessage({ type: "success", text: "Reviewer shared." });
    setShareMessage("");
  }

  async function saveShareToCloud(share) {
    const reviewer = cloneSharedReviewer(share.data);
    const { error } = await upsertCloudReviewer(user.id, reviewer);

    if (error) {
      setMessage({ type: "error", text: error.message || "Could not save shared reviewer to cloud." });
      return;
    }

    setMessage({ type: "success", text: "Shared reviewer saved to your cloud library." });
  }

  function saveShareOffline(share) {
    const reviewer = cloneSharedReviewer(share.data);
    saveLocalReviewer(reviewer);
    setMessage({ type: "success", text: "Shared reviewer saved offline on this device." });
  }

  async function dismissShare(share) {
    const { error } = await deleteReviewerShare(share.id);

    if (error) {
      setMessage({ type: "error", text: error.message || "Could not remove shared reviewer." });
      return;
    }

    setShares((current) => current.filter((item) => item.id !== share.id));
    setMessage({ type: "success", text: "Shared reviewer removed." });
  }

  if (!configured) {
    return (
      <div className="page narrow">
        <EmptyState title="Cloud sync is not configured" message="Add Supabase settings before using friends and sharing." />
      </div>
    );
  }

  if (loading) {
    return <div className="page narrow"><p className="muted">Checking session...</p></div>;
  }

  if (!user) {
    return (
      <div className="page narrow">
        <EmptyState
          title="Sign in to use friends"
          message="Friends and sharing need your Google account so shared reviewers know where to go."
          action={<Link className="button primary" to="/account">Go to Account</Link>}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Friends & Sharing</p>
          <h1>Study with friends</h1>
          <p className="muted">Find friends, share reviewers, and save reviewers shared with you.</p>
        </div>
        <button className="button subtle" type="button" onClick={refreshSocialData} disabled={loadingSocial}>
          <Users size={17} aria-hidden="true" />
          {loadingSocial ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {message ? <p className={`sync-message ${message.type}`}>{message.text}</p> : null}

      <section className="friends-grid">
        <article className="library-panel">
          <div className="library-panel-head">
            <div>
              <h2>Find Friends</h2>
              <p className="muted">Search by email or display name.</p>
            </div>
          </div>
          <form className="friend-search-form" onSubmit={searchForFriends}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="friend@email.com" />
            <button className="button primary" type="submit">
              <Search size={17} aria-hidden="true" />
              Search
            </button>
          </form>
          <div className="library-list">
            {searchResults.map((profile) => (
              <article className="library-row" key={profile.id}>
                <div>
                  <h3>{getProfileName(profile)}</h3>
                  <p className="muted">{profile.email}</p>
                </div>
                <button className="button subtle" type="button" onClick={() => requestFriend(profile)}>
                  <UserPlus size={17} aria-hidden="true" />
                  Add Friend
                </button>
              </article>
            ))}
          </div>
        </article>

        <article className="library-panel">
          <div className="library-panel-head">
            <div>
              <h2>Requests</h2>
              <p className="muted">Accept incoming requests or remove pending ones.</p>
            </div>
          </div>
          {incomingRequests.length || outgoingRequests.length ? (
            <div className="library-list">
              {incomingRequests.map((friendship) => (
                <article className="library-row" key={friendship.id}>
                  <div>
                    <h3>{getProfileName(friendship.otherProfile)}</h3>
                    <p className="muted">Incoming request</p>
                  </div>
                  <div className="button-row">
                    <button className="button primary" type="button" onClick={() => acceptRequest(friendship)}>
                      <Check size={17} aria-hidden="true" />
                      Accept
                    </button>
                    <button className="button subtle danger-text" type="button" onClick={() => removeConnection(friendship)}>
                      <Trash2 size={17} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </article>
              ))}
              {outgoingRequests.map((friendship) => (
                <article className="library-row" key={friendship.id}>
                  <div>
                    <h3>{getProfileName(friendship.otherProfile)}</h3>
                    <p className="muted">Request sent</p>
                  </div>
                  <button className="button subtle danger-text" type="button" onClick={() => removeConnection(friendship)}>
                    <Trash2 size={17} aria-hidden="true" />
                    Cancel
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No friend requests" message="Search for a friend to send one." />
          )}
        </article>
      </section>

      <section className="library-panel">
        <div className="library-panel-head">
          <div>
            <h2>Friends</h2>
            <p className="muted">Accepted friends can receive reviewers from you.</p>
          </div>
        </div>
        {acceptedFriends.length ? (
          <div className="library-list">
            {acceptedFriends.map((friendship) => (
              <article className="library-row" key={friendship.id}>
                <div>
                  <h3>{getProfileName(friendship.otherProfile)}</h3>
                  <p className="muted">{friendship.otherProfile?.email || "No email"}</p>
                </div>
                <button className="button subtle danger-text" type="button" onClick={() => removeConnection(friendship)}>
                  <Trash2 size={17} aria-hidden="true" />
                  Remove Friend
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No friends yet" message="Accept a request or search for a friend to start sharing." />
        )}
      </section>

      <section className="library-panel">
        <div className="library-panel-head">
          <div>
            <h2>Share Reviewer</h2>
            <p className="muted">Send one of your available reviewers to an accepted friend.</p>
          </div>
        </div>
        <form className="share-form" onSubmit={sendReviewerShare}>
          <label>
            <span>Reviewer</span>
            <select value={selectedReviewerId} onChange={(event) => setSelectedReviewerId(event.target.value)}>
              <option value="">Choose a reviewer</option>
              {reviewers.map((reviewer) => (
                <option value={reviewer.reviewerId} key={reviewer.reviewerId}>
                  {reviewer.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Friend</span>
            <select value={selectedFriendId} onChange={(event) => setSelectedFriendId(event.target.value)}>
              <option value="">Choose a friend</option>
              {acceptedFriends.map((friendship) => (
                <option value={friendship.otherUserId} key={friendship.id}>
                  {getProfileName(friendship.otherProfile)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Message</span>
            <input value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} placeholder="Optional note" />
          </label>
          <button className="button primary" type="submit">
            <Send size={17} aria-hidden="true" />
            Share Reviewer
          </button>
        </form>
      </section>

      <section className="library-panel">
        <div className="library-panel-head">
          <div>
            <h2>Shared With Me</h2>
            <p className="muted">Save shared reviewers to your own cloud or this device.</p>
          </div>
        </div>
        {shares.length ? (
          <div className="library-list">
            {shares.map((share) => (
              <article className="library-row" key={share.id}>
                <div>
                  <h3>{share.title}</h3>
                  <p className="muted">
                    {share.subject} - from {getProfileName(share.ownerProfile)}
                  </p>
                  {share.message ? <p className="sync-message pending">{share.message}</p> : null}
                </div>
                <div className="button-row">
                  <button className="button subtle" type="button" onClick={() => saveShareToCloud(share)}>
                    <Cloud size={17} aria-hidden="true" />
                    Save to Cloud
                  </button>
                  <button className="button subtle" type="button" onClick={() => saveShareOffline(share)}>
                    <Download size={17} aria-hidden="true" />
                    Save Offline
                  </button>
                  <button className="button subtle danger-text" type="button" onClick={() => dismissShare(share)}>
                    <Trash2 size={17} aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No shared reviewers" message="Reviewers your friends share with you will appear here." />
        )}
      </section>
    </div>
  );
}
