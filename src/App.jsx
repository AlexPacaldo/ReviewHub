import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import ReviewerSetup from "./pages/ReviewerSetup.jsx";
import Quiz from "./pages/Quiz.jsx";
import Results from "./pages/Results.jsx";
import ReviewAnswers from "./pages/ReviewAnswers.jsx";
import History from "./pages/History.jsx";
import { getThemePreference, saveThemePreference } from "./utils/storageUtils.js";

export default function App() {
  const [theme, setTheme] = useState(getThemePreference);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveThemePreference(theme);
  }, [theme]);

  return (
    <>
      <Navbar theme={theme} onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reviewer/:reviewerId" element={<ReviewerSetup />} />
          <Route path="/quiz/:reviewerId" element={<Quiz />} />
          <Route path="/results/:reviewerId" element={<Results />} />
          <Route path="/review/:reviewerId" element={<ReviewAnswers />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
