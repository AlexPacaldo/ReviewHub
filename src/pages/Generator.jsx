import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clipboard, Download, FileJson, FileText, HardDrive, Plus, Save, Sparkles, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
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

const sampleReviewerTemplate = {
  reviewerId: "sample-course-prelim-reviewer",
  title: "Sample Course - Prelim Reviewer",
  subject: "Sample Course",
  coverage: ["Topic 1", "Topic 2"],
  questionCount: 2,
  questionType: "multiple_choice",
  choicesPerQuestion: 4,
  instructions: "Select the best answer for each question.",
  questions: [
    {
      id: 1,
      topic: "Topic 1",
      question: "What is the main idea of this sample question?",
      choices: {
        A: "The correct answer",
        B: "A close but incorrect answer",
        C: "An unrelated answer",
        D: "Another incorrect answer"
      },
      correctAnswer: "A",
      answerText: "The correct answer",
      explanation: "Explain why A is correct using only the source material."
    },
    {
      id: 2,
      topic: "Topic 2",
      question: "Which choice best matches the source material?",
      choices: {
        A: "Incorrect option",
        B: "Correct option",
        C: "Incorrect option",
        D: "Incorrect option"
      },
      correctAnswer: "B",
      answerText: "Correct option",
      explanation: "Explain why B is correct and why the other options are less accurate."
    }
  ]
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

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeReviewerJson(reviewer) {
  const questions = Array.isArray(reviewer?.questions) ? reviewer.questions : [];
  const normalizedQuestions = questions.map((question, index) => {
    const correctAnswer = String(question.correctAnswer || "A").toUpperCase();
    const choices = question.choices || {};

    return {
      id: question.id || index + 1,
      topic: question.topic || "Generated Reviewer",
      question: question.question || "",
      choices: {
        A: choices.A || "",
        B: choices.B || "",
        C: choices.C || "",
        D: choices.D || ""
      },
      correctAnswer,
      answerText: question.answerText || choices[correctAnswer] || "",
      explanation: question.explanation || ""
    };
  });
  const title = reviewer?.title || "Generated Reviewer";
  const subject = reviewer?.subject || "Generated";
  const coverage = Array.isArray(reviewer?.coverage) && reviewer.coverage.length
    ? reviewer.coverage
    : [...new Set(normalizedQuestions.map((question) => question.topic).filter(Boolean))];

  return {
    ...reviewer,
    reviewerId: `${slugify(reviewer?.reviewerId || title || subject || "generated-reviewer")}-${Date.now()}`,
    title,
    subject,
    coverage,
    questionCount: normalizedQuestions.length,
    questionType: "multiple_choice",
    choicesPerQuestion: 4,
    instructions: reviewer?.instructions || "Select the best answer for each question.",
    questions: normalizedQuestions
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
  const [jsonText, setJsonText] = useState("");
  const [errors, setErrors] = useState([]);
  const [templateMessage, setTemplateMessage] = useState("");

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
  const sampleTemplateText = useMemo(() => JSON.stringify(sampleReviewerTemplate, null, 2), []);

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

  function saveReviewerJson(rawJson) {
    try {
      const parsedReviewer = JSON.parse(rawJson);
      const reviewer = normalizeReviewerJson(parsedReviewer);
      const validation = validateReviewer(reviewer);

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      saveLocalReviewer(reviewer);
      navigate(`/reviewer/${reviewer.reviewerId}`);
    } catch {
      setErrors(["Paste valid reviewer JSON before saving."]);
    }
  }

  async function copySampleTemplate() {
    try {
      await navigator.clipboard.writeText(sampleTemplateText);
      setTemplateMessage("Template copied.");
    } catch {
      setJsonText(sampleTemplateText);
      setTemplateMessage("Template placed in the JSON box.");
    }
  }

  function downloadSampleTemplate() {
    downloadTextFile("review_hub_reviewer_template.json", sampleTemplateText);
    setTemplateMessage("Template downloaded.");
  }

  function handleJsonFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const nextJsonText = String(reader.result || "");
      setJsonText(nextJsonText);
      saveReviewerJson(nextJsonText);
    };
    reader.onerror = () => setErrors(["Could not read that JSON file."]);
    reader.readAsText(file);
    event.target.value = "";
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

          <div className="json-import-panel">
            <div className="generator-panel-head compact">
              <FileJson size={20} aria-hidden="true" />
              <div>
                <h2>Paste Reviewer JSON</h2>
                <p className="muted">Use this when an AI tool already produced reviewer JSON.</p>
              </div>
            </div>
            <label className="prompt-box">
              <span>JSON</span>
              <textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} placeholder='{"title":"Sample Reviewer","subject":"Sample","questions":[...]}' />
            </label>
            <div className="button-row">
              <button className="button subtle" type="button" onClick={() => saveReviewerJson(jsonText)}>
                <Save size={17} aria-hidden="true" />
                Save JSON
              </button>
              <label className="button subtle file-button">
                <Upload size={17} aria-hidden="true" />
                Import JSON File
                <input type="file" accept="application/json,.json" onChange={handleJsonFile} />
              </label>
            </div>
          </div>

          <div className="template-panel">
            <div className="generator-panel-head compact">
              <Clipboard size={20} aria-hidden="true" />
              <div>
                <h2>JSON Template</h2>
                <p className="muted">Give this format to an AI tool, then paste the completed JSON above.</p>
              </div>
            </div>
            <pre className="template-preview">{sampleTemplateText}</pre>
            <div className="button-row">
              <button className="button subtle" type="button" onClick={copySampleTemplate}>
                <Clipboard size={17} aria-hidden="true" />
                Copy Template
              </button>
              <button className="button subtle" type="button" onClick={downloadSampleTemplate}>
                <Download size={17} aria-hidden="true" />
                Download Template
              </button>
              {templateMessage ? <span className="template-message">{templateMessage}</span> : null}
            </div>
          </div>

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
