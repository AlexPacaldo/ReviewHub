import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import ReviewerSetup from "./pages/ReviewerSetup.jsx";
import Quiz from "./pages/Quiz.jsx";
import Results from "./pages/Results.jsx";
import ReviewAnswers from "./pages/ReviewAnswers.jsx";
import History from "./pages/History.jsx";
import Library from "./pages/Library.jsx";
import Generator from "./pages/Generator.jsx";
import Account from "./pages/Account.jsx";
import Friends from "./pages/Friends.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { getThemePreference, saveThemePreference } from "./utils/storageUtils.js";
import { logClientError } from "./utils/errorLogger.js";

export default function App() {
  const [theme, setTheme] = useState(getThemePreference);
  const [updateReady, setUpdateReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(() => localStorage.getItem("reviewer_install_dismissed") === "true");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const showUpdateNotice = () => setUpdateReady(true);

    window.addEventListener("reviewhub:update-ready", showUpdateNotice);
    return () => window.removeEventListener("reviewhub:update-ready", showUpdateNotice);
  }, []);

  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  useEffect(() => {
    const handleError = (event) => {
      logClientError("window-error", event.error || event.message, {
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      });
    };
    const handleUnhandledRejection = (event) => {
      logClientError("unhandled-rejection", event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  function dismissInstallPrompt() {
    localStorage.setItem("reviewer_install_dismissed", "true");
    setInstallDismissed(true);
  }

  return (
    <AuthProvider>
      <Navbar theme={theme} onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
      {updateReady ? (
        <div className="update-banner" role="status">
          <span>New offline version ready.</span>
          <button className="button subtle" type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      ) : null}
      {installPrompt && !installDismissed ? (
        <div className="install-banner" role="status">
          <span>Install Hachi for faster offline access.</span>
          <div className="button-row">
            <button className="button primary" type="button" onClick={installApp}>
              Install
            </button>
            <button className="button subtle" type="button" onClick={dismissInstallPrompt}>
              Later
            </button>
          </div>
        </div>
      ) : null}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reviewer/:reviewerId" element={<ReviewerSetup />} />
          <Route path="/quiz/:reviewerId" element={<Quiz />} />
          <Route path="/results/:reviewerId" element={<Results />} />
          <Route path="/review/:reviewerId" element={<ReviewAnswers />} />
          <Route path="/history" element={<History />} />
          <Route path="/library" element={<Library />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/account" element={<Account />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AuthProvider>
  );
}
