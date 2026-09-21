import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import ReviewerCard from "../components/ReviewerCard.jsx";
import ReviewerSearch from "../components/ReviewerSearch.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getAllReviewers } from "../data/reviewerRegistry.js";
import { listVisibleCloudReviewers } from "../services/cloudReviewers.js";
import { clearCloudReviewerCache, deleteLocalReviewer, getAllProgress, getAttemptHistory, REVIEWER_DATA_CHANGED_EVENT, saveCloudReviewerCache } from "../utils/storageUtils.js";

export default function Home() {
  const { configured, loading, user } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [reviewerList, setReviewerList] = useState(getAllReviewers);
  const [cloudLoadMessage, setCloudLoadMessage] = useState("");
  const progress = getAllProgress();
  const recentAttempts = getAttemptHistory().slice(0, 5);

  useEffect(() => {
    let isMounted = true;

    async function loadSignedInReviewers() {
      if (loading) return;

      if (!configured || !user) {
        clearCloudReviewerCache();
        setReviewerList(getAllReviewers());
        setCloudLoadMessage("");
        return;
      }

      const { data, error } = await listVisibleCloudReviewers(user.id);

      if (!isMounted) return;

      if (error) {
        setCloudLoadMessage(error.message || "Could not refresh reviewers.");
        setReviewerList(getAllReviewers());
        return;
      }

      setCloudLoadMessage("");
      const cachedReviewers = (data || []).map((item) => {
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
      setReviewerList(getAllReviewers());
    }

    loadSignedInReviewers();

    return () => {
      isMounted = false;
    };
  }, [configured, loading, user?.id]);

  useEffect(() => {
    const refreshReviewers = () => setReviewerList(getAllReviewers());

    window.addEventListener(REVIEWER_DATA_CHANGED_EVENT, refreshReviewers);
    window.addEventListener("storage", refreshReviewers);
    return () => {
      window.removeEventListener(REVIEWER_DATA_CHANGED_EVENT, refreshReviewers);
      window.removeEventListener("storage", refreshReviewers);
    };
  }, []);

  const filteredReviewers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reviewerList;

    const myName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

    return reviewerList.filter((reviewer) => {
      const haystack = [
        reviewer.title,
        reviewer.subject,
        reviewer.reviewerId,
        reviewer.ownerName || (user ? myName : ""),
        ...(reviewer.coverage || [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [reviewerList, search, user?.id]);

  const isSharedReviewer = useMemo(() => (reviewer) => {
    if (!user) return false;
    if (reviewer.ownerId) return reviewer.ownerId !== user.id;
    return Boolean(reviewer.ownerName);
  }, [user]);

  const ownReviewers = useMemo(() => filteredReviewers.filter((reviewer) => !isSharedReviewer(reviewer)), [filteredReviewers, isSharedReviewer]);
  const friendsReviewers = useMemo(() => filteredReviewers.filter((reviewer) => isSharedReviewer(reviewer)), [filteredReviewers, isSharedReviewer]);

  const renderReviewerGrid = (reviewers) => (
    <div className="reviewer-grid">
      {reviewers.map((reviewer) =>
        reviewer.validation.isValid ? (
          <ReviewerCard
            key={`${reviewer.source}-${reviewer.reviewerId}`}
            reviewer={reviewer}
            progress={progress[reviewer.reviewerId]}
            onDelete={removeLocalReviewer}
          />
        ) : (
          <article className="reviewer-card error-card" key={reviewer.reviewerId || reviewer.title}>
            <h3>Unable to load this reviewer.</h3>
            <p>{reviewer.title || "Untitled reviewer"}</p>
            <p className="muted">{reviewer.validation.errors[0]}</p>
          </article>
        )
      )}
    </div>
  );

  const hasSearch = search.trim().length > 0;
  const emptyState = hasSearch
    ? { title: "No reviewers found", message: "Try another search term." }
    : sourceFilter === "friends"
      ? { title: "No friends reviewers yet", message: "Reviewers your friends share with you will appear here." }
      : sourceFilter === "mine"
        ? { title: "No reviewers here", message: "Add or sync a reviewer from Library to see it here." }
        : { title: "No reviewers yet", message: "Explore Library to save reviewers for your study sessions." };

  function removeLocalReviewer(reviewer) {
    const confirmed = window.confirm(`Remove "${reviewer.title}" from this device?`);
    if (!confirmed) return;

    deleteLocalReviewer(reviewer.reviewerId);
    setReviewerList(getAllReviewers());
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Reviewer library</p>
        <h1>Hachi</h1>
        <p>Your study companion.</p>
      </section>

      <section className="section-heading">
        <div>
          <h2>Choose a Reviewer</h2>
          <p className="muted">Search by subject, title, course code, coverage topic, or creator.</p>
        </div>
        <ReviewerSearch value={search} onChange={setSearch} />
      </section>

      {user ? (
        <div className="filter-pills" role="tablist" aria-label="Filter reviewers">
          <button
            type="button"
            role="tab"
            aria-selected={sourceFilter === "all"}
            className={sourceFilter === "all" ? "active" : ""}
            onClick={() => setSourceFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceFilter === "mine"}
            className={sourceFilter === "mine" ? "active" : ""}
            onClick={() => setSourceFilter("mine")}
          >
            Mine
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceFilter === "friends"}
            className={sourceFilter === "friends" ? "active" : ""}
            onClick={() => setSourceFilter("friends")}
          >
            Friends
          </button>
        </div>
      ) : null}

      {sourceFilter === "all" && user ? (
        <>
          {ownReviewers.length ? (
            <section className="reviewer-group">
              <div className="reviewer-group-head">
                <h3>Your Reviewers</h3>
                <span className="muted">{ownReviewers.length}</span>
              </div>
              {renderReviewerGrid(ownReviewers)}
            </section>
          ) : null}

          {friendsReviewers.length ? (
            <section className="reviewer-group">
              <div className="reviewer-group-head">
                <h3>Shared with You</h3>
                <span className="muted">{friendsReviewers.length}</span>
              </div>
              {renderReviewerGrid(friendsReviewers)}
            </section>
          ) : null}

          {!ownReviewers.length && !friendsReviewers.length ? (
            <EmptyState title={emptyState.title} message={emptyState.message} />
          ) : null}
        </>
      ) : (
        <>
          {renderReviewerGrid(sourceFilter === "friends" && user ? friendsReviewers : ownReviewers)}
          {(sourceFilter === "friends" && user ? friendsReviewers : ownReviewers).length ? null : (
            <EmptyState title={emptyState.title} message={emptyState.message} />
          )}
        </>
      )}
      {cloudLoadMessage ? <p className="sync-message error">{cloudLoadMessage}</p> : null}

      <section className="recent-section">
        <div className="section-heading compact">
          <div>
            <h2>Recent Attempts</h2>
            <p className="muted">Your latest completed quizzes are stored in this browser.</p>
          </div>
          <Link className="button subtle" to="/history">
            View History
          </Link>
        </div>

        {recentAttempts.length ? (
          <div className="attempt-list">
            {recentAttempts.map((attempt) => (
              <Link className="attempt-row" to={`/results/${attempt.reviewerId}?attempt=${attempt.attemptId}`} key={attempt.attemptId}>
                <span>
                  <strong>{attempt.reviewerTitle}</strong>
                  <small>{new Date(attempt.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</small>
                </span>
                <span>{attempt.score} / {attempt.totalQuestions}</span>
                <span>{attempt.percentage}%</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No attempts yet" message="Complete a quiz and your score will appear here." />
        )}
      </section>
    </div>
  );
}
