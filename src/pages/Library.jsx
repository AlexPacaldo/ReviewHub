import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, HardDrive, Trash2, Wifi, WifiOff } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { getAllReviewers, reviewers } from "../data/reviewerRegistry.js";
import {
  clearAllQuizProgress,
  clearAttemptHistory,
  clearLocalReviewers,
  deleteLocalReviewer,
  getAllProgress,
  getAttemptHistory,
  getLocalDataSnapshot,
  getLocalReviewers
} from "../utils/storageUtils.js";

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Library() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isStandalone, setIsStandalone] = useState(false);
  const [localReviewers, setLocalReviewers] = useState(getLocalReviewers);
  const [progress, setProgress] = useState(getAllProgress);
  const [history, setHistory] = useState(getAttemptHistory);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setIsStandalone(standalone);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const stats = useMemo(() => {
    const progressSessions = Object.keys(progress).length;
    return {
      builtInReviewers: reviewers.length,
      allReviewers: getAllReviewers().length,
      localReviewers: localReviewers.length,
      history: history.length,
      progressSessions
    };
  }, [history.length, localReviewers.length, progress]);

  function refreshLocalData() {
    setLocalReviewers(getLocalReviewers());
    setProgress(getAllProgress());
    setHistory(getAttemptHistory());
  }

  function runConfirmedAction() {
    if (confirmAction?.type === "clear-history") {
      clearAttemptHistory();
    }

    if (confirmAction?.type === "clear-progress") {
      clearAllQuizProgress();
    }

    if (confirmAction?.type === "remove-reviewer") {
      deleteLocalReviewer(confirmAction.reviewerId);
    }

    if (confirmAction?.type === "clear-local-reviewers") {
      clearLocalReviewers();
    }

    setConfirmAction(null);
    refreshLocalData();
  }

  return (
    <div className="page">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Device Library</p>
          <h1>Library & Settings</h1>
          <p className="muted">Manage data saved on this device. Account and cloud features can plug in here later.</p>
        </div>
        <button className="button primary" type="button" onClick={() => downloadJson("review_hub_local_backup.json", getLocalDataSnapshot())}>
          <Download size={17} aria-hidden="true" />
          Export Backup
        </button>
      </section>

      <section className="library-status-grid">
        <article className="library-status-card">
          {isOnline ? <Wifi size={20} aria-hidden="true" /> : <WifiOff size={20} aria-hidden="true" />}
          <span>Connection</span>
          <strong>{isOnline ? "Online" : "Offline"}</strong>
        </article>
        <article className="library-status-card">
          <HardDrive size={20} aria-hidden="true" />
          <span>App Mode</span>
          <strong>{isStandalone ? "Installed" : "Browser"}</strong>
        </article>
        <article className="library-status-card">
          <span>Built-in Reviewers</span>
          <strong>{stats.builtInReviewers}</strong>
        </article>
        <article className="library-status-card">
          <span>Saved Offline</span>
          <strong>{stats.localReviewers}</strong>
        </article>
        <article className="library-status-card">
          <span>Unfinished Quizzes</span>
          <strong>{stats.progressSessions}</strong>
        </article>
        <article className="library-status-card">
          <span>Completed Attempts</span>
          <strong>{stats.history}</strong>
        </article>
      </section>

      <section className="library-panel">
        <div className="library-panel-head">
          <div>
            <h2>Saved Offline Reviewers</h2>
            <p className="muted">Reviewers saved on this device will be available without signing in.</p>
          </div>
          {localReviewers.length ? (
            <button
              className="button subtle danger-text"
              type="button"
              onClick={() => setConfirmAction({ type: "clear-local-reviewers" })}
            >
              <Trash2 size={17} aria-hidden="true" />
              Clear Saved
            </button>
          ) : null}
        </div>

        {localReviewers.length ? (
          <div className="library-list">
            {localReviewers.map((reviewer) => (
              <article className="library-row" key={reviewer.reviewerId}>
                <div>
                  <h3>{reviewer.title}</h3>
                  <p className="muted">{reviewer.subject} · {reviewer.questions?.length || reviewer.questionCount} questions</p>
                </div>
                <div className="button-row">
                  <Link className="button primary" to={`/reviewer/${reviewer.reviewerId}`}>
                    Open
                  </Link>
                  <button
                    className="button subtle danger-text"
                    type="button"
                    onClick={() => setConfirmAction({ type: "remove-reviewer", reviewerId: reviewer.reviewerId })}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved offline reviewers"
            message="When online cloud reviewers exist later, this is where saved-for-offline reviewers will appear."
          />
        )}
      </section>

      <section className="library-panel">
        <h2>Local Data</h2>
        <p className="muted">These actions only affect data stored on this device.</p>
        <div className="library-actions">
          <button className="button subtle" type="button" onClick={() => downloadJson("review_hub_local_backup.json", getLocalDataSnapshot())}>
            <Download size={17} aria-hidden="true" />
            Export Local Backup
          </button>
          <button className="button subtle danger-text" type="button" onClick={() => setConfirmAction({ type: "clear-progress" })}>
            Clear Unfinished Quizzes
          </button>
          <button className="button subtle danger-text" type="button" onClick={() => setConfirmAction({ type: "clear-history" })}>
            Clear Attempt History
          </button>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title="Confirm Action"
        message="This changes data saved on this device. This cannot be undone."
        confirmLabel="Continue"
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}
