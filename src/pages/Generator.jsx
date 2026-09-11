import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, HardDrive, Plus, Save, Sparkles, Trash2, Wifi, WifiOff } from "lucide-react";
import { validateReviewer } from "../data/reviewerRegistry.js";
import { saveLocalReviewer } from "../utils/storageUtils.js";

const emptyQuestion = {
  topic: "",
  question: "",
  A: "",
  B: "",
  C: "",
  D: "",
  correctAnswer: "A",
  explanation: ""
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildReviewer({ title, subject, instructions }, questions) {
  const safeTitle = title.trim();
  const safeSubject = subject.trim();
  const reviewerQuestions = questions.map((question, index) => ({
    id: index + 1,
    topic: question.topic.trim(),
    question: question.question.trim(),
    choices: {
      A: question.A.trim(),
      B: question.B.trim(),
      C: question.C.trim(),
      D: question.D.trim()
    },
    correctAnswer: question.correctAnswer,
    answerText: question[question.correctAnswer].trim(),
    explanation: question.explanation.trim()
  }));

  return {
    reviewerId: `${slugify(safeTitle || safeSubject || "generated-reviewer")}-${Date.now()}`,
    title: safeTitle,
    subject: safeSubject,
    coverage: [...new Set(reviewerQuestions.map((question) => question.topic).filter(Boolean))],
    questionCount: reviewerQuestions.length,
    questionType: "multiple_choice",
    choicesPerQuestion: 4,
    instructions: instructions.trim() || "Select the best answer for each question.",
    questions: reviewerQuestions
  };
}

export default function Generator() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [details, setDetails] = useState({
    title: "",
    subject: "",
    instructions: "Select the best answer for each question."
  });
  const [questionDraft, setQuestionDraft] = useState(emptyQuestion);
  const [questions, setQuestions] = useState([]);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const draftPreview = useMemo(() => buildReviewer(details, questions), [details, questions]);

  function updateDetails(key, value) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function updateQuestion(key, value) {
    setQuestionDraft((current) => ({ ...current, [key]: value }));
  }

  function validateQuestionDraft() {
    const missingFields = ["topic", "question", "A", "B", "C", "D", "explanation"].filter((field) => !questionDraft[field].trim());
    if (missingFields.length) {
      return ["Complete the question, choices, topic, and explanation before adding it."];
    }
    return [];
  }

  function addQuestion() {
    const draftErrors = validateQuestionDraft();
    if (draftErrors.length) {
      setErrors(draftErrors);
      return;
    }

    setQuestions((current) => [...current, questionDraft]);
    setQuestionDraft(emptyQuestion);
    setErrors([]);
  }

  function removeQuestion(indexToRemove) {
    setQuestions((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function saveDraftReviewer() {
    const reviewer = buildReviewer(details, questions);
    const validation = validateReviewer(reviewer);
    const nextErrors = [];

    if (!details.title.trim()) nextErrors.push("Add a reviewer title.");
    if (!details.subject.trim()) nextErrors.push("Add a subject.");
    if (!questions.length) nextErrors.push("Add at least one question.");
    if (!validation.isValid) nextErrors.push(...validation.errors);

    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    saveLocalReviewer(reviewer);
    navigate(`/reviewer/${reviewer.reviewerId}`);
  }

  return (
    <div className="page">
      <section className="section-heading">
        <div>
          <p className="eyebrow">AI Generator</p>
          <h1>Create a reviewer draft</h1>
          <p className="muted">Build a local reviewer now. Later, online or device AI can fill this same draft format automatically.</p>
        </div>
        <span className={`generator-status ${isOnline ? "online" : "offline"}`}>
          {isOnline ? <Wifi size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}
          {isOnline ? "Online" : "Offline"}
        </span>
      </section>

      <section className="generator-layout">
        <div className="generator-panel">
          <div className="generator-panel-head">
            <FileText size={22} aria-hidden="true" />
            <div>
              <h2>Draft Builder</h2>
              <p className="muted">Create questions manually first, then save them as an offline reviewer.</p>
            </div>
          </div>

          <div className="generator-form-grid">
            <label>
              <span>Reviewer Title</span>
              <input value={details.title} onChange={(event) => updateDetails("title", event.target.value)} placeholder="Example: Biology Prelim Reviewer" />
            </label>
            <label>
              <span>Subject</span>
              <input value={details.subject} onChange={(event) => updateDetails("subject", event.target.value)} placeholder="Example: Biology" />
            </label>
          </div>

          <label className="prompt-box">
            <span>Instructions</span>
            <textarea value={details.instructions} onChange={(event) => updateDetails("instructions", event.target.value)} />
          </label>

          <div className="question-builder">
            <div className="generator-panel-head compact">
              <Sparkles size={20} aria-hidden="true" />
              <div>
                <h2>Question {questions.length + 1}</h2>
                <p className="muted">Add one complete multiple-choice question at a time.</p>
              </div>
            </div>

            <div className="generator-form-grid">
              <label>
                <span>Topic</span>
                <input value={questionDraft.topic} onChange={(event) => updateQuestion("topic", event.target.value)} placeholder="Example: Photosynthesis" />
              </label>
              <label>
                <span>Correct Answer</span>
                <select value={questionDraft.correctAnswer} onChange={(event) => updateQuestion("correctAnswer", event.target.value)}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>
            </div>

            <label className="prompt-box">
              <span>Question</span>
              <textarea value={questionDraft.question} onChange={(event) => updateQuestion("question", event.target.value)} placeholder="Write the question here." />
            </label>

            <div className="choice-entry-grid">
              {["A", "B", "C", "D"].map((letter) => (
                <label key={letter}>
                  <span>{letter}</span>
                  <input value={questionDraft[letter]} onChange={(event) => updateQuestion(letter, event.target.value)} placeholder={`Choice ${letter}`} />
                </label>
              ))}
            </div>

            <label className="prompt-box">
              <span>Explanation</span>
              <textarea value={questionDraft.explanation} onChange={(event) => updateQuestion("explanation", event.target.value)} placeholder="Explain why the correct answer is correct." />
            </label>

            <button className="button subtle" type="button" onClick={addQuestion}>
              <Plus size={18} aria-hidden="true" />
              Add Question
            </button>
          </div>

          {errors.length ? (
            <div className="generator-errors" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <button className="button primary large" type="button" onClick={saveDraftReviewer}>
            <Save size={18} aria-hidden="true" />
            Save Offline Reviewer
          </button>
        </div>

        <aside className="generator-panel">
          <div className="generator-panel-head">
            <HardDrive size={22} aria-hidden="true" />
            <div>
              <h2>Draft Preview</h2>
              <p className="muted">{questions.length} question{questions.length === 1 ? "" : "s"} ready to save.</p>
            </div>
          </div>

          <div className="generator-preview">
            <strong>{draftPreview.title || "Untitled reviewer"}</strong>
            <span>{draftPreview.subject || "No subject yet"}</span>
            <span>{draftPreview.coverage.length || 0} coverage areas</span>
          </div>

          <div className="draft-question-list">
            {questions.length ? (
              questions.map((question, index) => (
                <article key={`${question.question}-${index}`}>
                  <div>
                    <span>Question {index + 1}</span>
                    <strong>{question.question}</strong>
                    <p className="muted">{question.correctAnswer}: {question[question.correctAnswer]}</p>
                  </div>
                  <button className="button subtle icon-danger" type="button" onClick={() => removeQuestion(index)} aria-label={`Remove question ${index + 1}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </article>
              ))
            ) : (
              <div className="generator-path-list">
                <article>
                  <span>Online and signed in</span>
                  <p>Online AI will generate reviewers, save them to the database, and let users share with friends.</p>
                </article>
                <article>
                  <span>Offline or not signed in</span>
                  <p>This manual draft flow saves reviewers only on this device.</p>
                </article>
                <article>
                  <span>Future iPhone app</span>
                  <p>Device AI can later fill this same draft when Apple exposes the right local model access.</p>
                </article>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
