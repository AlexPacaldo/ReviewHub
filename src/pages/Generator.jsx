import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clipboard, Download, FileJson, FileText, HardDrive, Plus, RotateCcw, Save, Sparkles, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
import { validateReviewer } from "../data/reviewerRegistry.js";
import { clearGeneratorDraft, getGeneratorDraft, saveGeneratorDraft, saveLocalReviewer } from "../utils/storageUtils.js";

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
  const savedDraft = getGeneratorDraft();
  const skipNextAutosave = useRef(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [details, setDetails] = useState(savedDraft?.details || {
    title: "",
    subject: "",
    instructions: "Select the best answer for each question."
  });
  const [questionDraft, setQuestionDraft] = useState(savedDraft?.questionDraft || emptyQuestion);
  const [questions, setQuestions] = useState(savedDraft?.questions || []);
  const [sourceText, setSourceText] = useState(savedDraft?.sourceText || "");
  const [jsonText, setJsonText] = useState(savedDraft?.jsonText || "");
  const [errors, setErrors] = useState([]);
  const [jsonCheck, setJsonCheck] = useState(null);
  const [templateMessage, setTemplateMessage] = useState("");
  const [promptMessage, setPromptMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState(savedDraft?.savedAt ? `Draft restored from ${new Date(savedDraft.savedAt).toLocaleString()}.` : "");

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }

    saveGeneratorDraft({
      details,
      questionDraft,
      questions,
      sourceText,
      jsonText
    });
    setDraftMessage("Draft saved on this device.");
  }, [details, questionDraft, questions, sourceText, jsonText]);

  const draftPreview = useMemo(() => buildReviewer(details, questions), [details, questions]);
  const sampleTemplateText = useMemo(() => JSON.stringify(sampleReviewerTemplate, null, 2), []);
  const aiPromptText = useMemo(() => (
    `Create a complete multiple-choice reviewer from ONLY the study material below.

Rules:
- Return valid JSON only. Do not wrap it in markdown.
- Follow the exact schema shown in the template.
- Use 4 choices per question: A, B, C, and D.
- Include correctAnswer and answerText for every question.
- Include a short explanation for every question.
- Keep questions verifiable from the study material.
- If the material is short, create fewer high-quality questions instead of inventing facts.

JSON template:
${sampleTemplateText}

Study material:
${sourceText || "[Paste study material here]"}`
  ), [sampleTemplateText, sourceText]);

  function updateDetails(key, value) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function updateQuestion(key, value) {
    setQuestionDraft((current) => ({ ...current, [key]: value }));
  }

  function updateJsonText(value) {
    setJsonText(value);
    setJsonCheck(null);
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
    clearGeneratorDraft();
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
      clearGeneratorDraft();
      navigate(`/reviewer/${reviewer.reviewerId}`);
    } catch {
      setErrors(["Paste valid reviewer JSON before saving."]);
    }
  }

  function checkReviewerJson(rawJson) {
    try {
      const parsedReviewer = JSON.parse(rawJson);
      const reviewer = normalizeReviewerJson(parsedReviewer);
      const validation = validateReviewer(reviewer);

      if (!validation.isValid) {
        setJsonCheck(null);
        setErrors(validation.errors);
        return;
      }

      setErrors([]);
      setJsonCheck({
        title: reviewer.title,
        subject: reviewer.subject,
        questions: reviewer.questions.length,
        coverage: reviewer.coverage.length
      });
    } catch {
      setJsonCheck(null);
      setErrors(["Paste valid reviewer JSON before checking."]);
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

  async function copyAiPrompt() {
    try {
      await navigator.clipboard.writeText(aiPromptText);
      setPromptMessage("AI prompt copied.");
    } catch {
      setPromptMessage("Copy failed. Select the prompt text manually.");
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
      updateJsonText(nextJsonText);
      checkReviewerJson(nextJsonText);
    };
    reader.onerror = () => setErrors(["Could not read that JSON file."]);
    reader.readAsText(file);
    event.target.value = "";
  }

  function clearDraft() {
    clearGeneratorDraft();
    skipNextAutosave.current = true;
    setDetails({
      title: "",
      subject: "",
      instructions: "Select the best answer for each question."
    });
    setQuestionDraft(emptyQuestion);
    setQuestions([]);
    setSourceText("");
    setJsonText("");
    setErrors([]);
    setJsonCheck(null);
    setTemplateMessage("");
    setPromptMessage("");
    setDraftMessage("Draft cleared.");
  }

  return (
    <div className="page">
      <section className="section-heading">
        <div>
          <p className="eyebrow">AI Generator</p>
          <h1>Generate or import a reviewer</h1>
          <p className="muted">Use AI-generated JSON now, then connect online file upload and cloud AI later.</p>
          {draftMessage ? <p className="draft-save-note">{draftMessage}</p> : null}
        </div>
        <div className="generator-heading-actions">
          <span className={`generator-status ${isOnline ? "online" : "offline"}`}>
            {isOnline ? <Wifi size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}
            {isOnline ? "Online" : "Offline"}
          </span>
          <button className="button subtle" type="button" onClick={clearDraft}>
            <RotateCcw size={17} aria-hidden="true" />
            Clear Draft
          </button>
        </div>
      </section>

      <section className="generator-layout">
        <div className="generator-panel">
          <div className="generator-panel-head">
            <Sparkles size={22} aria-hidden="true" />
            <div>
              <h2>AI File Generator</h2>
              <p className="muted">This will become the main upload-to-reviewer workflow.</p>
            </div>
          </div>

          <label className="upload-zone ai-upload-zone">
            <input type="file" disabled aria-label="Upload study file for AI generation" />
            <Upload size={30} aria-hidden="true" />
            <strong>File upload will go here</strong>
            <span>When online and signed in, this will use cloud AI. Offline mode will stay focused on saved reviewers and local study.</span>
          </label>

          <div className="ai-prompt-panel">
            <div className="generator-panel-head compact">
              <Clipboard size={20} aria-hidden="true" />
              <div>
                <h2>Study Material Prompt</h2>
                <p className="muted">Paste notes here, then copy a complete prompt for ChatGPT or another AI tool.</p>
              </div>
            </div>
            <label className="prompt-box">
              <span>Study Material</span>
              <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste your handout, notes, or reviewer source text here." />
            </label>
            <div className="button-row">
              <button className="button subtle" type="button" onClick={copyAiPrompt}>
                <Clipboard size={17} aria-hidden="true" />
                Copy AI Prompt
              </button>
              {promptMessage ? <span className="template-message">{promptMessage}</span> : null}
            </div>
          </div>

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
              <textarea value={jsonText} onChange={(event) => updateJsonText(event.target.value)} placeholder='{"title":"Sample Reviewer","subject":"Sample","questions":[...]}' />
            </label>
            <div className="button-row">
              <button className="button subtle" type="button" onClick={() => checkReviewerJson(jsonText)}>
                <FileJson size={17} aria-hidden="true" />
                Check JSON
              </button>
              <button className="button subtle" type="button" onClick={() => saveReviewerJson(jsonText)}>
                <Save size={17} aria-hidden="true" />
                Save JSON
              </button>
              <label className="button subtle file-button">
                <Upload size={17} aria-hidden="true" />
                Load JSON File
                <input type="file" accept="application/json,.json" onChange={handleJsonFile} />
              </label>
            </div>
            {jsonCheck ? (
              <div className="json-check-card" role="status">
                <strong>JSON looks ready.</strong>
                <span>{jsonCheck.title} - {jsonCheck.subject}</span>
                <span>{jsonCheck.questions} questions across {jsonCheck.coverage} coverage areas</span>
              </div>
            ) : null}
          </div>

          {errors.length ? (
            <div className="generator-errors" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

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

          <div className="manual-builder-panel">
            <div className="generator-panel-head compact">
              <FileText size={20} aria-hidden="true" />
              <div>
                <h2>Manual Builder</h2>
                <p className="muted">Fallback for creating or testing a reviewer without AI.</p>
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

            <button className="button primary large" type="button" onClick={saveDraftReviewer}>
              <Save size={18} aria-hidden="true" />
              Save Manual Reviewer
            </button>
          </div>
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
                  <span>Future app option</span>
                  <p>The project is website-first for now. A mobile app can reuse this reviewer format later.</p>
                </article>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
