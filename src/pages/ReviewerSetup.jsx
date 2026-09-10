import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { getReviewerById } from "../data/reviewerRegistry.js";
import EmptyState from "../components/EmptyState.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { createQuizSession } from "../utils/quizUtils.js";
import { clearQuizProgress, loadQuizProgress, saveQuizProgress } from "../utils/storageUtils.js";

export default function ReviewerSetup() {
  const { reviewerId } = useParams();
  const navigate = useNavigate();
  const reviewer = getReviewerById(reviewerId);
  const savedProgress = reviewer ? loadQuizProgress(reviewer.reviewerId) : null;
  const [showStartOver, setShowStartOver] = useState(false);

  const availableCounts = useMemo(() => {
    const total = reviewer?.questions?.length || 0;
    return [10, 20, 30, 50].filter((count) => count < total).concat(total ? [total] : []);
  }, [reviewer]);

  const [settings, setSettings] = useState({
    questionCount: availableCounts[0] || 0,
    questionOrder: "random",
    choiceOrder: "shuffle",
    mode: "practice"
  });

  if (!reviewer || !reviewer.validation.isValid) {
    return <EmptyState title="Unable to load this reviewer." message={reviewer?.validation.errors[0] || "The reviewer does not exist."} action={<Link className="button primary" to="/">Back to Reviewers</Link>} />;
  }

  const startQuiz = (retryIds = null) => {
    const session = createQuizSession(reviewer, settings, retryIds);
    saveQuizProgress(session);
    navigate(`/quiz/${reviewer.reviewerId}`);
  };

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="page narrow">
      <Link className="back-link" to="/">
        <ArrowLeft size={17} aria-hidden="true" />
        Back to Reviewers
      </Link>

      <section className="setup-panel">
        <p className="eyebrow">{reviewer.subject}</p>
        <h1>{reviewer.title}</h1>
        <p className="muted">{reviewer.instructions}</p>
        <div className="stat-strip">
          <span><strong>{reviewer.questions.length}</strong> available questions</span>
          <span><strong>{reviewer.coverage.length}</strong> coverage areas</span>
        </div>

        <div className="coverage-block setup">
          <h2>Coverage</h2>
          <ul>
            {reviewer.coverage.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </div>
      </section>

      {savedProgress ? (
        <section className="notice-panel">
          <h2>Unfinished Quiz</h2>
          <p>You have an unfinished {reviewer.subject} quiz.</p>
          <div className="button-row">
            <button className="button primary" type="button" onClick={() => navigate(`/quiz/${reviewer.reviewerId}`)}>
              Continue Quiz
            </button>
            <button className="button subtle" type="button" onClick={() => setShowStartOver(true)}>
              Start Over
            </button>
          </div>
        </section>
      ) : null}

      <section className="setup-panel">
        <h2>Quiz Setup</h2>

        <fieldset>
          <legend>Number of Questions</legend>
          <div className="segmented">
            {availableCounts.map((count) => (
              <button
                key={count}
                type="button"
                className={settings.questionCount === count ? "active" : ""}
                onClick={() => updateSetting("questionCount", count)}
              >
                {count === reviewer.questions.length ? "All Questions" : count}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Question Order</legend>
          <div className="segmented">
            <button type="button" className={settings.questionOrder === "random" ? "active" : ""} onClick={() => updateSetting("questionOrder", "random")}>Random</button>
            <button type="button" className={settings.questionOrder === "original" ? "active" : ""} onClick={() => updateSetting("questionOrder", "original")}>Original Order</button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Answer Choice Order</legend>
          <div className="segmented">
            <button type="button" className={settings.choiceOrder === "shuffle" ? "active" : ""} onClick={() => updateSetting("choiceOrder", "shuffle")}>Shuffle Choices</button>
            <button type="button" className={settings.choiceOrder === "original" ? "active" : ""} onClick={() => updateSetting("choiceOrder", "original")}>Original Order</button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Quiz Mode</legend>
          <div className="mode-options">
            <button
              type="button"
              className={`mode-card ${settings.mode === "practice" ? "active" : ""}`}
              onClick={() => updateSetting("mode", "practice")}
            >
              <strong>Practice Mode</strong>
              <span>Shows if your answer is correct immediately, displays the correct answer and explanation, then lets you continue.</span>
            </button>
            <button
              type="button"
              className={`mode-card ${settings.mode === "exam" ? "active" : ""}`}
              onClick={() => updateSetting("mode", "exam")}
            >
              <strong>Exam Mode</strong>
              <span>Lets you answer, go back, and change choices. Correct answers and explanations appear only after final submission.</span>
            </button>
          </div>
        </fieldset>

        <button className="button primary large" type="button" onClick={() => startQuiz()}>
          <Play size={18} aria-hidden="true" />
          Start Quiz
        </button>
      </section>

      <ConfirmModal
        open={showStartOver}
        title="Start Over?"
        message="This will replace your unfinished quiz for this reviewer."
        confirmLabel="Start Over"
        onCancel={() => setShowStartOver(false)}
        onConfirm={() => {
          clearQuizProgress(reviewer.reviewerId);
          setShowStartOver(false);
          startQuiz();
        }}
      />
    </div>
  );
}
