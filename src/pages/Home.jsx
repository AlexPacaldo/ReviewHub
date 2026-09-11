import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import ReviewerCard from "../components/ReviewerCard.jsx";
import ReviewerSearch from "../components/ReviewerSearch.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { getAllReviewers } from "../data/reviewerRegistry.js";
import { deleteLocalReviewer, getAllProgress, getAttemptHistory } from "../utils/storageUtils.js";

export default function Home() {
  const [search, setSearch] = useState("");
  const [reviewerList, setReviewerList] = useState(getAllReviewers);
  const progress = getAllProgress();
  const recentAttempts = getAttemptHistory().slice(0, 5);

  const filteredReviewers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reviewerList;

    return reviewerList.filter((reviewer) => {
      const haystack = [reviewer.title, reviewer.subject, reviewer.reviewerId, ...(reviewer.coverage || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [reviewerList, search]);

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
        <h1>Review Hub</h1>
        <p>Study smarter. Test what you know.</p>
      </section>

      <section className="section-heading">
        <div>
          <h2>Choose a Reviewer</h2>
          <p className="muted">Search by subject, title, course code, or coverage topic.</p>
        </div>
        <ReviewerSearch value={search} onChange={setSearch} />
      </section>

      {filteredReviewers.length ? (
        <div className="reviewer-grid">
          {filteredReviewers.map((reviewer) =>
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
      ) : (
        <EmptyState title="No reviewers found" message="Try another search term." />
      )}

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
