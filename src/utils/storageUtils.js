const KEYS = {
  progress: "reviewer_quiz_progress",
  history: "reviewer_attempt_history",
  theme: "reviewer_theme",
  lastAttempt: "reviewer_last_attempt",
  localReviewers: "reviewer_local_reviewers",
  cloudReviewerCache: "reviewer_cloud_reviewer_cache",
  generatorDraft: "reviewer_generator_draft"
};

export const REVIEWER_DATA_CHANGED_EVENT = "reviewer-data-changed";

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function notifyReviewerDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REVIEWER_DATA_CHANGED_EVENT));
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getThemePreference() {
  return localStorage.getItem(KEYS.theme) || "light";
}

export function saveThemePreference(theme) {
  localStorage.setItem(KEYS.theme, theme);
}

export function getAllProgress() {
  return readJson(KEYS.progress, {});
}

export function clearAllQuizProgress() {
  writeJson(KEYS.progress, {});
}

export function loadQuizProgress(reviewerId) {
  return getAllProgress()[reviewerId] || null;
}

export function saveQuizProgress(session) {
  const progress = getAllProgress();
  progress[session.reviewerId] = session;
  writeJson(KEYS.progress, progress);
}

export function clearQuizProgress(reviewerId) {
  const progress = getAllProgress();
  delete progress[reviewerId];
  writeJson(KEYS.progress, progress);
}

export function getAttemptHistory() {
  return readJson(KEYS.history, []);
}

export function saveAttempt(attempt) {
  const history = [attempt, ...getAttemptHistory()];
  writeJson(KEYS.history, history);
  writeJson(KEYS.lastAttempt, { [attempt.reviewerId]: attempt });
  return history;
}

export function clearAttemptHistory() {
  writeJson(KEYS.history, []);
}

export function getAttemptById(attemptId) {
  return getAttemptHistory().find((attempt) => attempt.attemptId === attemptId) || null;
}

export function getLatestAttempt(reviewerId) {
  return getAttemptHistory().find((attempt) => attempt.reviewerId === reviewerId) || null;
}

export function getLocalReviewers() {
  return readJson(KEYS.localReviewers, []);
}

export function saveLocalReviewer(reviewer) {
  const existing = getLocalReviewers().filter((item) => item.reviewerId !== reviewer.reviewerId);
  const nextReviewers = [
    {
      ...reviewer,
      savedAt: new Date().toISOString()
    },
    ...existing
  ];
  writeJson(KEYS.localReviewers, nextReviewers);
  notifyReviewerDataChanged();
  return nextReviewers;
}

export function deleteLocalReviewer(reviewerId) {
  const nextReviewers = getLocalReviewers().filter((reviewer) => reviewer.reviewerId !== reviewerId);
  writeJson(KEYS.localReviewers, nextReviewers);
  clearQuizProgress(reviewerId);
  notifyReviewerDataChanged();
  return nextReviewers;
}

export function clearLocalReviewers() {
  writeJson(KEYS.localReviewers, []);
  notifyReviewerDataChanged();
}

export function getCloudReviewerCache() {
  return readJson(KEYS.cloudReviewerCache, []);
}

export function saveCloudReviewerCache(reviewers) {
  const nextReviewers = Array.isArray(reviewers) ? reviewers : [];
  writeJson(KEYS.cloudReviewerCache, nextReviewers);
  notifyReviewerDataChanged();
  return nextReviewers;
}

export function clearCloudReviewerCache() {
  localStorage.removeItem(KEYS.cloudReviewerCache);
  notifyReviewerDataChanged();
}

export function getGeneratorDraft() {
  return readJson(KEYS.generatorDraft, null);
}

export function saveGeneratorDraft(draft) {
  writeJson(KEYS.generatorDraft, {
    ...draft,
    savedAt: new Date().toISOString()
  });
}

export function clearGeneratorDraft() {
  localStorage.removeItem(KEYS.generatorDraft);
}

export function clearAllDeviceData() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  notifyReviewerDataChanged();
}

export function restoreLocalDataSnapshot(snapshot) {
  if (!isObject(snapshot)) {
    throw new Error("Backup file must contain a local data object.");
  }

  writeJson(KEYS.progress, isObject(snapshot.progress) ? snapshot.progress : {});
  writeJson(KEYS.history, Array.isArray(snapshot.history) ? snapshot.history : []);
  writeJson(KEYS.lastAttempt, isObject(snapshot.lastAttempt) ? snapshot.lastAttempt : {});
  writeJson(KEYS.localReviewers, Array.isArray(snapshot.localReviewers) ? snapshot.localReviewers : []);
  writeJson(KEYS.cloudReviewerCache, Array.isArray(snapshot.cloudReviewerCache) ? snapshot.cloudReviewerCache : []);

  if (isObject(snapshot.generatorDraft)) {
    writeJson(KEYS.generatorDraft, snapshot.generatorDraft);
  } else {
    localStorage.removeItem(KEYS.generatorDraft);
  }

  if (typeof snapshot.theme === "string") {
    saveThemePreference(snapshot.theme);
  }

  notifyReviewerDataChanged();
  return getLocalDataSnapshot();
}

export function getLocalDataSnapshot() {
  return {
    exportedAt: new Date().toISOString(),
    progress: getAllProgress(),
    history: getAttemptHistory(),
    lastAttempt: readJson(KEYS.lastAttempt, {}),
    localReviewers: getLocalReviewers(),
    cloudReviewerCache: getCloudReviewerCache(),
    generatorDraft: getGeneratorDraft(),
    theme: getThemePreference()
  };
}
