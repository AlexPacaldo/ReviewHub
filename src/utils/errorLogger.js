const ERROR_LOG_KEY = "reviewer_error_log";
const MAX_ERROR_LOGS = 25;

function readLogs() {
  try {
    const value = localStorage.getItem(ERROR_LOG_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function normalizeError(error) {
  if (!error) return { name: "Error", message: "Unknown error" };

  if (typeof error === "string") {
    return { name: "Error", message: error.slice(0, 500) };
  }

  return {
    name: error.name || "Error",
    message: String(error.message || error.reason || "Unknown error").slice(0, 500),
    stack: typeof error.stack === "string" ? error.stack.slice(0, 1200) : ""
  };
}

export function logClientError(source, error, metadata = {}) {
  const entry = {
    id: `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    createdAt: new Date().toISOString(),
    error: normalizeError(error),
    metadata
  };
  const nextLogs = [entry, ...readLogs()].slice(0, MAX_ERROR_LOGS);

  try {
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(nextLogs));
  } catch {
    // If storage is full or blocked, console logging is still useful in production.
  }

  console.error(`[Hachi] ${source}`, entry.error, metadata);
  return entry;
}

export function getClientErrorLogs() {
  return readLogs();
}

export function clearClientErrorLogs() {
  localStorage.removeItem(ERROR_LOG_KEY);
}
