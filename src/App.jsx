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

export default function App() {
  const [theme, setTheme] = useState(getThemePreference);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const showUpdateNotice = () => setUpdateReady(true);

    window.addEventListener("reviewhub:update-ready", showUpdateNotice);
    return () => window.removeEventListener("reviewhub:update-ready", showUpdateNotice);
  }, []);

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
