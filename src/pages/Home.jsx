import { Link } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import { FileDown, Upload } from "lucide-react";
import ReviewerCard from "../components/ReviewerCard.jsx";
import ReviewerSearch from "../components/ReviewerSearch.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { getAllReviewers, reviewers, validateReviewer } from "../data/reviewerRegistry.js";
import { deleteLocalReviewer, getAllProgress, getAttemptHistory, saveLocalReviewer } from "../utils/storageUtils.js";

export default function Home() {
  const [search, setSearch] = useState("");
  const [reviewerList, setReviewerList] = useState(getAllReviewers);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);
  const progress = getAllProgress();
  const recentAttempts = getAttemptHistory().slice(0, 5);
  const sampleReviewer = useMemo(() => {
    const { validation, source, ...reviewer } = reviewers[0];
    return reviewer;
  }, []);

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

  async function importReviewer(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const reviewer = JSON.parse(text);
      const validation = validateReviewer(reviewer);
      const existingReviewer = getAllReviewers().find((item) => item.reviewerId === reviewer.reviewerId);

      if (!validation.isValid) {
        setImportStatus({ type: "error", message: `Import failed: ${validation.errors[0]}` });
        return;
      }

      if (existingReviewer?.source === "built-in") {
        setImportStatus({ type: "error", message: "Import failed: a built-in reviewer already uses that reviewerId." });
        return;
      }

      saveLocalReviewer(reviewer);
      setReviewerList(getAllReviewers());
      setImportStatus({ type: "success", message: `${reviewer.title} was saved for offline use.` });
    } catch {
      setImportStatus({ type: "error", message: "Import failed: choose a valid reviewer JSON file." });
    } finally {
      event.target.value = "";
    }
  }

  function removeLocalReviewer(reviewer) {
    const confirmed = window.confirm(`Remove "${reviewer.title}" from this device?`);
    if (!confirmed) return;

    deleteLocalReviewer(reviewer.reviewerId);
    setReviewerList(getAllReviewers());
    setImportStatus({ type: "success", message: `${reviewer.title} was removed from this device.` });
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

      <section className="import-panel">
        <div>
          <h2>Local Reviewers</h2>
          <p className="muted">Import a reviewer JSON file and keep it available on this device.</p>
        </div>
        <div className="button-row">
          <button className="button subtle" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={17} aria-hidden="true" />
            Import JSON
          </button>
          <a
            className="button subtle"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sampleReviewer, null, 2))}`}
            download="sample_reviewer.json"
          >
            <FileDown size={17} aria-hidden="true" />
            Sample Format
          </a>
          <input ref={fileInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={importReviewer} />
        </div>
      </section>

      {importStatus ? <p className={`import-status ${importStatus.type}`}>{importStatus.message}</p> : null}

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
