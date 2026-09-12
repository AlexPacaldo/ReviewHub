import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cloud, Download, HardDrive, RefreshCw, Smartphone, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { getAllReviewers, reviewers } from "../data/reviewerRegistry.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { listMyCloudReviewers, upsertCloudReviewer } from "../services/cloudReviewers.js";
import {
  clearAllQuizProgress,
  clearAttemptHistory,
  clearGeneratorDraft,
  clearLocalReviewers,
  deleteLocalReviewer,
  getAllProgress,
  getAttemptHistory,
  getGeneratorDraft,
  getLocalDataSnapshot,
  getLocalReviewers,
  restoreLocalDataSnapshot,
  saveLocalReviewer
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
  const { configured, user } = useAuth();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isStandalone, setIsStandalone] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [localReviewers, setLocalReviewers] = useState(getLocalReviewers);
  const [progress, setProgress] = useState(getAllProgress);
  const [history, setHistory] = useState(getAttemptHistory);
  const [generatorDraft, setGeneratorDraft] = useState(getGeneratorDraft);
  const [confirmAction, setConfirmAction] = useState(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState({});
  const [cloudReviewers, setCloudReviewers] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const [offlineSaveStatus, setOfflineSaveStatus] = useState({});
  const [storageInfo, setStorageInfo] = useState({
    supported: false,
    persisted: false,
    usage: null,
    quota: null
  });

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setIsStandalone(standalone);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    refreshStorageInfo();
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
    };
  }, []);

  useEffect(() => {
    loadCloudReviewers();
  }, [configured, user?.id]);

  const stats = useMemo(() => {
    const progressSessions = Object.keys(progress).length;
    return {
      builtInReviewers: reviewers.length,
      allReviewers: getAllReviewers().length,
      localReviewers: localReviewers.length,
      cloudReviewers: cloudReviewers.length,
      history: history.length,
      progressSessions,
      generatorDrafts: generatorDraft ? 1 : 0
    };
  }, [cloudReviewers.length, generatorDraft, history.length, localReviewers.length, progress]);

  function refreshLocalData() {
    setLocalReviewers(getLocalReviewers());
    setProgress(getAllProgress());
    setHistory(getAttemptHistory());
    setGeneratorDraft(getGeneratorDraft());
  }

  async function refreshStorageInfo() {
    if (!navigator.storage) {
      setStorageInfo({ supported: false, persisted: false, usage: null, quota: null });
      return;
    }

    const [persisted, estimate] = await Promise.all([
      navigator.storage.persisted ? navigator.storage.persisted() : false,
      navigator.storage.estimate ? navigator.storage.estimate() : {}
    ]);

    setStorageInfo({
      supported: true,
      persisted,
      usage: estimate.usage || null,
      quota: estimate.quota || null
    });
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      setBackupMessage("Persistent storage is not supported in this browser.");
      return;
    }

    const persisted = await navigator.storage.persist();
    await refreshStorageInfo();
    setBackupMessage(persisted ? "Offline data is protected from automatic cleanup." : "Browser did not grant persistent storage yet.");
  }

  function formatBytes(value) {
    if (!value) return "Unknown";
    const units = ["B", "KB", "MB", "GB"];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  async function loadCloudReviewers() {
    if (!configured || !user) {
      setCloudReviewers([]);
      setCloudMessage("");
      return;
    }

    setCloudLoading(true);
    setCloudMessage("");
    const { data, error } = await listMyCloudReviewers(user.id);
    setCloudLoading(false);

    if (error) {
      setCloudMessage(error.message || "Could not load cloud reviewers.");
      return;
    }

    setCloudReviewers(data || []);
  }

  function getCloudReviewerData(item) {
    return item?.data || item;
  }

  function getCloudReviewerKey(item) {
    return item?.id || item?.reviewer_id || getCloudReviewerData(item)?.reviewerId;
  }

  function isReviewerSavedOffline(reviewerId) {
    return localReviewers.some((reviewer) => reviewer.reviewerId === reviewerId);
  }

  function saveCloudReviewerOffline(item) {
    const reviewer = getCloudReviewerData(item);
    const key = getCloudReviewerKey(item);

    if (!reviewer?.reviewerId) {
      setOfflineSaveStatus((current) => ({
        ...current,
        [key]: { type: "error", message: "This cloud reviewer is missing a reviewer ID." }
      }));
      return;
    }

    saveLocalReviewer(reviewer);
    refreshLocalData();
    setOfflineSaveStatus((current) => ({
      ...current,
      [key]: { type: "success", message: "Saved offline on this device." }
    }));
  }

  function restoreBackupFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snapshot = JSON.parse(String(reader.result || ""));
        restoreLocalDataSnapshot(snapshot);
        refreshLocalData();
        setBackupMessage("Backup restored on this device.");
      } catch (error) {
        setBackupMessage(error?.message || "Could not restore that backup file.");
      }
    };
    reader.onerror = () => setBackupMessage("Could not read that backup file.");
    reader.readAsText(file);
    event.target.value = "";
  }

  async function syncReviewerToCloud(reviewer) {
    if (!configured) {
      setSyncStatus((current) => ({
        ...current,
        [reviewer.reviewerId]: { type: "error", message: "Add Supabase env vars first." }
      }));
      return;
    }

    if (!user) {
      setSyncStatus((current) => ({
        ...current,
        [reviewer.reviewerId]: { type: "error", message: "Sign in to sync this reviewer." }
      }));
      return;
    }

    setSyncStatus((current) => ({
      ...current,
      [reviewer.reviewerId]: { type: "pending", message: "Syncing..." }
    }));

    const { error } = await upsertCloudReviewer(user.id, reviewer);

    setSyncStatus((current) => ({
      ...current,
      [reviewer.reviewerId]: error
        ? { type: "error", message: error.message || "Could not sync reviewer." }
        : { type: "success", message: "Synced to cloud." }
    }));

    if (!error) {
      loadCloudReviewers();
    }
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

    if (confirmAction?.type === "clear-generator-draft") {
      clearGeneratorDraft();
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
          <p className="muted">Manage offline reviewers, cloud reviewers, backups, and device storage.</p>
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
          <Smartphone size={20} aria-hidden="true" />
          <span>Offline Ready</span>
          <strong>{offlineReady ? "Ready" : "Preparing"}</strong>
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
          <span>Cloud Reviewers</span>
          <strong>{user ? stats.cloudReviewers : "Sign in"}</strong>
        </article>
        <article className="library-status-card">
          <span>Unfinished Quizzes</span>
          <strong>{stats.progressSessions}</strong>
        </article>
        <article className="library-status-card">
          <span>Generator Draft</span>
          <strong>{stats.generatorDrafts ? "Saved" : "None"}</strong>
        </article>
        <article className="library-status-card">
          <span>Completed Attempts</span>
          <strong>{stats.history}</strong>
        </article>
      </section>

      <section className="library-panel install-panel">
        <div>
          <h2>Offline App Access</h2>
          <p className="muted">Open Review Hub once while online, then this device can reopen the app shell without internet.</p>
        </div>
        <div className="install-steps" aria-label="Offline app readiness">
          <span className={offlineReady ? "complete" : ""}>App shell cached</span>
          <span className={isStandalone ? "complete" : ""}>Installed app mode</span>
          <span className={!isOnline ? "complete" : ""}>Offline mode supported</span>
        </div>
        {!isStandalone ? (
          <div className="button-row">
            {installPrompt ? (
              <button className="button primary" type="button" onClick={installApp}>
                Install Review Hub
              </button>
            ) : (
              <p className="muted install-note">Use your browser menu and choose Install app or Add to Home Screen.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="library-panel">
        <div className="library-panel-head">
          <div>
            <h2>Cloud Reviewers</h2>
            <p className="muted">Reviewers synced to your account. Save one offline to keep it available on this device.</p>
          </div>
          {user ? (
            <button className="button subtle" type="button" onClick={loadCloudReviewers} disabled={cloudLoading}>
              <RefreshCw size={17} aria-hidden="true" />
              Refresh
            </button>
          ) : null}
        </div>

        {!configured ? (
          <EmptyState
            title="Cloud sync is not configured"
            message="Add your Supabase URL and anon key in Vercel to enable account reviewers."
          />
        ) : !user ? (
          <EmptyState
            title="Sign in to view cloud reviewers"
            message="Use Google sign-in to sync reviewers online and save them offline on each device."
            action={
              <Link className="button primary" to="/account">
                Go to Account
              </Link>
            }
          />
        ) : cloudLoading ? (
          <p className="muted">Loading cloud reviewers...</p>
        ) : cloudReviewers.length ? (
          <div className="library-list">
            {cloudReviewers.map((item) => {
              const reviewer = getCloudReviewerData(item);
              const key = getCloudReviewerKey(item);
              const reviewerId = reviewer?.reviewerId;
              const savedOffline = isReviewerSavedOffline(reviewerId);

              return (
                <article className="library-row" key={key}>
                  <div>
                    <h3>{reviewer?.title || item.title || "Untitled Reviewer"}</h3>
                    <p className="muted">
                      {reviewer?.subject || item.subject || "No subject"} - {reviewer?.questions?.length || reviewer?.questionCount || 0} questions
                    </p>
                    {offlineSaveStatus[key] ? (
                      <p className={`sync-message ${offlineSaveStatus[key].type}`}>{offlineSaveStatus[key].message}</p>
                    ) : null}
                  </div>
                  <div className="button-row">
                    {savedOffline ? (
                      <Link className="button primary" to={`/reviewer/${reviewerId}`}>
                        Open Offline
                      </Link>
                    ) : null}
                    <button className="button subtle" type="button" onClick={() => saveCloudReviewerOffline(item)} disabled={savedOffline}>
                      <Download size={17} aria-hidden="true" />
                      {savedOffline ? "Saved Offline" : "Save Offline"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No cloud reviewers yet"
            message="Sync a saved offline reviewer to your account and it will appear here."
          />
        )}
        {cloudMessage ? <p className="backup-message">{cloudMessage}</p> : null}
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
                  <p className="muted">{reviewer.subject} - {reviewer.questions?.length || reviewer.questionCount} questions</p>
                  {syncStatus[reviewer.reviewerId] ? (
                    <p className={`sync-message ${syncStatus[reviewer.reviewerId].type}`}>
                      {syncStatus[reviewer.reviewerId].message}
                    </p>
                  ) : null}
                </div>
                <div className="button-row">
                  <Link className="button primary" to={`/reviewer/${reviewer.reviewerId}`}>
                    Open
                  </Link>
                  {user ? (
                    <button
                      className="button subtle"
                      type="button"
                      onClick={() => syncReviewerToCloud(reviewer)}
                      disabled={syncStatus[reviewer.reviewerId]?.type === "pending"}
                    >
                      <Cloud size={17} aria-hidden="true" />
                      Sync to Cloud
                    </button>
                  ) : (
                    <Link className="button subtle" to="/account">
                      <Cloud size={17} aria-hidden="true" />
                      Sign In to Sync
                    </Link>
                  )}
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
            message="Save a cloud reviewer offline or create a reviewer to keep it on this device."
          />
        )}
      </section>

      <section className="library-panel">
        <h2>Local Data</h2>
        <p className="muted">These actions only affect data stored on this device.</p>
        <div className="local-data-grid">
          <article className="local-data-row">
            <div>
              <h3>Storage Protection</h3>
              <p className="muted">
                {storageInfo.supported
                  ? `${storageInfo.persisted ? "Protected" : "Not protected yet"} - ${formatBytes(storageInfo.usage)} used of ${formatBytes(storageInfo.quota)} available.`
                  : "This browser does not report storage protection status."}
              </p>
            </div>
            <div className="button-row">
              <button className="button subtle" type="button" onClick={requestPersistentStorage}>
                Protect Offline Data
              </button>
            </div>
          </article>
          <article className="local-data-row">
            <div>
              <h3>Generator Draft</h3>
              <p className="muted">
                {generatorDraft
                  ? `Saved ${new Date(generatorDraft.savedAt).toLocaleString()} with ${generatorDraft.questions?.length || 0} added questions.`
                  : "No unfinished Generator draft is saved on this device."}
              </p>
            </div>
            <div className="button-row">
              <Link className="button subtle" to="/generator">
                Open Generator
              </Link>
              {generatorDraft ? (
                <button className="button subtle danger-text" type="button" onClick={() => setConfirmAction({ type: "clear-generator-draft" })}>
                  Clear Draft
                </button>
              ) : null}
            </div>
          </article>
        </div>
        <div className="library-actions">
          <button className="button subtle" type="button" onClick={() => downloadJson("review_hub_local_backup.json", getLocalDataSnapshot())}>
            <Download size={17} aria-hidden="true" />
            Export Local Backup
          </button>
          <label className="button subtle file-button">
            <Upload size={17} aria-hidden="true" />
            Restore Backup
            <input type="file" accept="application/json,.json" onChange={restoreBackupFile} />
          </label>
          <button className="button subtle danger-text" type="button" onClick={() => setConfirmAction({ type: "clear-progress" })}>
            Clear Unfinished Quizzes
          </button>
          <button className="button subtle danger-text" type="button" onClick={() => setConfirmAction({ type: "clear-history" })}>
            Clear Attempt History
          </button>
        </div>
        {backupMessage ? <p className="backup-message">{backupMessage}</p> : null}
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
