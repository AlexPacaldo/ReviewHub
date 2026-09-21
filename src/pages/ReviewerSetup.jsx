import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Cloud, HardDrive, Play, Users } from "lucide-react";
import { getReviewerById } from "../data/reviewerRegistry.js";
import EmptyState from "../components/EmptyState.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import ReviewerMenu from "../components/ReviewerMenu.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { createQuizSession, getQuestionTypeOptions, getStoredQuestionTypes } from "../utils/quizUtils.js";
import { clearQuizProgress, getLatestAttempt, loadQuizProgress, saveQuizProgress } from "../utils/storageUtils.js";

const QUESTION_TYPE_LABELS = {
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
  identification: "Identification",
  flashcard: "Flashcards"
};

export default function ReviewerSetup() {
  const { reviewerId } = useParams();
  const navigate = useNavigate();
  const { configured, user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuMessage, setMenuMessage] = useState(null);
  const reviewer = useMemo(() => getReviewerById(reviewerId), [reviewerId, refreshKey]);
  const savedProgress = reviewer ? loadQuizProgress(reviewer.reviewerId) : null;
  const latestAttempt = reviewer ? getLatestAttempt(reviewer.reviewerId) : null;
  const [showStartOver, setShowStartOver] = useState(false);
  const storageStatus = reviewer?.storageStatus || reviewer?.source || "built-in";
  const hasLocal = storageStatus === "both" || reviewer?.source === "local";
  const hasCloud = storageStatus === "both" || reviewer?.source === "cloud";
  const isOwnerReviewer = user
    ? reviewer?.ownerId
      ? reviewer.ownerId === user.id
      : reviewer?.source !== "cloud" && reviewer?.source !== "built-in"
    : reviewer?.source === "local";
  const isSharedWithMe = Boolean(reviewer?.ownerName) && !isOwnerReviewer;
  const mistakeIds = latestAttempt?.incorrectQuestionIds || [];

  const totalQuestions = reviewer?.questions?.length || 0;
  const questionCountMin = Math.min(10, totalQuestions);
  const questionCountMax = Math.max(questionCountMin, Math.min(100, totalQuestions));
  const defaultQuestionCount = Math.min(Math.max(questionCountMin, totalQuestions <= 10 ? totalQuestions : 10), questionCountMax);

  const questionTypeOptions = useMemo(() => (reviewer ? getQuestionTypeOptions(reviewer) : []), [reviewer]);
  const defaultQuestionTypes = useMemo(() => (reviewer ? getStoredQuestionTypes(reviewer) : []), [reviewer]);

  const [settings, setSettings] = useState({
    questionCount: defaultQuestionCount,
    questionOrder: "random",
    choiceOrder: "shuffle",
    mode: "practice",
    timeLimitMinutes: 15,
    questionTypes: defaultQuestionTypes.length ? defaultQuestionTypes : ["multiple_choice"],
    difficulty: "all"
  });

  if (!reviewer || !reviewer.validation.isValid) {
    return <EmptyState title="Unable to load this reviewer." message={reviewer?.validation.errors[0] || "The reviewer does not exist."} action={<Link className="button primary" to="/">Back to Reviewers</Link>} />;
  }

  const startQuiz = (retryIds = null, overrides = {}) => {
    const nextSettings = { ...settings, ...overrides };
    const session = createQuizSession(reviewer, nextSettings, retryIds);
    saveQuizProgress(session);
    navigate(`/quiz/${reviewer.reviewerId}`);
  };

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const toggleQuestionType = (value) => {
    setSettings((current) => {
      if (value === "flashcard") {
        return current.questionTypes.includes("flashcard")
          ? { ...current, questionTypes: defaultQuestionTypes, mode: "practice" }
          : { ...current, questionTypes: ["flashcard"], mode: "flashcard" };
      }

      const hadFlashcard = current.questionTypes.includes("flashcard");
      let nextTypes;

      if (hadFlashcard) {
        const base = defaultQuestionTypes.includes(value) ? defaultQuestionTypes : [...defaultQuestionTypes, value];
        nextTypes = base.length ? base : [value];
      } else {
        const toggled = current.questionTypes.includes(value)
          ? current.questionTypes.filter((type) => type !== value)
          : [...current.questionTypes, value];
        nextTypes = toggled.length ? toggled : defaultQuestionTypes;
      }

      return {
        ...current,
        questionTypes: [...new Set(nextTypes)],
        mode: hadFlashcard || current.mode === "flashcard" ? "practice" : current.mode
      };
    });
  };

  return (
    <div className="page narrow">
      <Link className="back-link" to="/">
        <ArrowLeft size={17} aria-hidden="true" />
        Back to Reviewers
      </Link>

      <section className="setup-panel">
        <div className="reviewer-head-row">
          <div className="reviewer-head-copy">
            <p className="eyebrow">{reviewer.subject}</p>
            <h1>{reviewer.title}</h1>
          </div>
          <ReviewerMenu
            reviewer={reviewer}
            user={user}
            configured={configured}
            onMessage={setMenuMessage}
            onChanged={() => setRefreshKey((current) => current + 1)}
          />
        </div>
        <p className="muted">{reviewer.instructions}</p>
        <div className="stat-strip">
          <span><strong>{reviewer.questions.length}</strong> available questions</span>
          <span><strong>{reviewer.coverage.length}</strong> coverage areas</span>
        </div>
        {menuMessage ? <p className={`sync-message ${menuMessage.type}`}>{menuMessage.text}</p> : null}

        <div className="availability-box">
          <div className="availability-icon" aria-hidden="true">
            {isSharedWithMe ? <Users size={20} /> : hasCloud && isOwnerReviewer ? <Cloud size={20} /> : hasLocal ? <HardDrive size={20} /> : <BookOpen size={20} />}
          </div>
          <div>
            <h2>
              {isSharedWithMe
                ? `Shared with you by ${reviewer.ownerName}`
                : hasCloud && isOwnerReviewer
                  ? "Saved in your cloud account"
                  : hasLocal
                    ? "Saved on this device"
                    : "Built into Hachi"}
            </h2>
            <p className="muted">
              {isSharedWithMe
                ? "From your friend's cloud library. Save offline to keep it on this device."
                : hasCloud && isOwnerReviewer
                  ? "Synced to your account and available on any signed-in device."
                  : hasLocal
                    ? "Stored locally and remains available without signing in."
                    : "Bundled with the app, so it is already available for offline study."}
            </p>
          </div>
          <Link className="button subtle" to="/library">
            Manage Library
          </Link>
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
          <label className="question-count-control">
            <span className="question-count-value">
              <strong>{settings.questionCount}</strong>
              <small>out of {totalQuestions} questions</small>
            </span>
            <input
              type="range"
              min={questionCountMin}
              max={questionCountMax}
              step={1}
              value={settings.questionCount}
              onChange={(event) => updateSetting("questionCount", Number(event.target.value))}
            />
            <span className="question-count-range">
              <small>{questionCountMin}</small>
              <small>{questionCountMax}</small>
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend>Difficulty</legend>
          <div className="segmented">
            <button type="button" className={settings.difficulty === "all" ? "active" : ""} onClick={() => updateSetting("difficulty", "all")}>All</button>
            <button type="button" className={settings.difficulty === "easy" ? "active" : ""} onClick={() => updateSetting("difficulty", "easy")}>Easy</button>
            <button type="button" className={settings.difficulty === "medium" ? "active" : ""} onClick={() => updateSetting("difficulty", "medium")}>Medium</button>
            <button type="button" className={settings.difficulty === "hard" ? "active" : ""} onClick={() => updateSetting("difficulty", "hard")}>Hard</button>
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

        {questionTypeOptions.length ? (
          <fieldset>
            <legend>Question Type</legend>
            <div className="type-check-grid">
              {questionTypeOptions.map((type) => (
                <label
                  className={`type-check-card ${settings.questionTypes.includes(type) ? "active" : ""}`}
                  key={type}
                >
                  <input
                    type="checkbox"
                    checked={settings.questionTypes.includes(type)}
                    onChange={() => toggleQuestionType(type)}
                  />
                  <span>
                    <strong>{QUESTION_TYPE_LABELS[type]}</strong>
                    <small>
                      {type === "flashcard"
                        ? "Card-style review"
                        : type === "identification"
                          ? "Type the answer in"
                          : type === "true_false"
                            ? "True or false"
                            : "Pick the best choice"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <p className="muted">
              {settings.questionTypes.includes("flashcard")
                ? "Flashcards run as their own review session and won't mix with other question types."
                : questionTypeOptions.length > 1
                  ? "Pick the formats to use. Selecting only one converts the whole quiz to it."
                  : "This reviewer uses this question format."}
            </p>
          </fieldset>
        ) : null}

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
            <button
              type="button"
              className={`mode-card ${settings.mode === "timed" ? "active" : ""}`}
              onClick={() => updateSetting("mode", "timed")}
            >
              <strong>Timed Mode</strong>
              <span>Runs like exam mode with a countdown timer and submits automatically when time runs out.</span>
            </button>
            <button
              type="button"
              className={`mode-card ${settings.mode === "mistakes" ? "active" : ""}`}
              onClick={() => updateSetting("mode", "mistakes")}
              disabled={!mistakeIds.length}
            >
              <strong>Mistakes-Only Mode</strong>
              <span>Reviews only the questions missed in your most recent completed attempt.</span>
            </button>
            <button
              type="button"
              className={`mode-card ${settings.mode === "flashcard" ? "active" : ""}`}
              onClick={() => updateSetting("mode", "flashcard")}
            >
              <strong>Flashcard Mode</strong>
              <span>Shows the prompt first, then reveals the answer so you can mark whether you remembered it.</span>
            </button>
          </div>
        </fieldset>

        {settings.mode === "timed" ? (
          <label className="time-limit-control">
            <span>Time Limit</span>
            <select value={settings.timeLimitMinutes} onChange={(event) => updateSetting("timeLimitMinutes", Number(event.target.value))}>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </label>
        ) : null}

        <button
          className="button primary large"
          type="button"
          onClick={() => settings.mode === "mistakes"
            ? startQuiz(mistakeIds, { questionCount: mistakeIds.length, questionOrder: "original" })
            : startQuiz()}
          disabled={settings.mode === "mistakes" && !mistakeIds.length}
        >
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
