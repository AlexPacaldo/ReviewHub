import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileJson, FileText, HardDrive, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
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
  const [generationMessage, setGenerationMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
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

  async function generateReviewerWithAi() {
    const trimmedSourceText = sourceText.trim();

    if (!isOnline) {
      setErrors(["Connect to the internet before using Gemini generation."]);
      return;
    }

    if (trimmedSourceText.length < 100) {
      setErrors(["Paste more study material before generating a reviewer."]);
      return;
    }

    setIsGenerating(true);
    setErrors([]);
    setJsonCheck(null);
    setGenerationMessage("Generating reviewer with Gemini...");

    try {
      const response = await fetch("/api/generate-reviewer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceText: trimmedSourceText,
          title: details.title,
          subject: details.subject,
          instructions: details.instructions,
          questionCount: 20
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Gemini could not generate a reviewer.");
      }

      const nextJsonText = JSON.stringify(data.reviewer, null, 2);
      updateJsonText(nextJsonText);
      checkReviewerJson(nextJsonText);
      setGenerationMessage("Reviewer JSON generated. Check it, then save it.");
    } catch (error) {
      setGenerationMessage("");
      setErrors([error?.message || "Could not generate a reviewer."]);
    } finally {
      setIsGenerating(false);
    }
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
    setDraftMessage("Draft cleared.");
  }

  return (
    <div className="page">
      <section className="section-heading">
        <div>
          <p className="eyebrow">AI Generator</p>
          <h1>Generate or import a reviewer</h1>
          <p className="muted">Paste study material, generate reviewer JSON with Gemini, then save it for offline study.</p>
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
              <h2>Generate Reviewer</h2>
              <p className="muted">Paste your study material and let Gemini create a quiz-ready reviewer.</p>
            </div>
          </div>

          <div className="ai-prompt-panel">
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
              <span>Study Material</span>
              <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste your handout, notes, or reviewer source text here." />
            </label>
            <div className="button-row">
              <button className="button primary" type="button" onClick={generateReviewerWithAi} disabled={isGenerating || !isOnline}>
                {isGenerating ? <Loader2 size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
                {isGenerating ? "Generating..." : "Generate with Gemini"}
              </button>
              {generationMessage ? <span className="template-message">{generationMessage}</span> : null}
            </div>
          </div>

          {jsonText ? (
            <div className="json-import-panel">
              <div className="generator-panel-head compact">
                <FileJson size={20} aria-hidden="true" />
                <div>
                  <h2>Generated Reviewer</h2>
                  <p className="muted">Check the generated reviewer, then save it to this device.</p>
                </div>
              </div>
              {jsonCheck ? (
                <div className="json-check-card" role="status">
                  <strong>{jsonCheck.title}</strong>
                  <span>{jsonCheck.subject}</span>
                  <span>{jsonCheck.questions} questions across {jsonCheck.coverage} coverage areas</span>
                </div>
              ) : null}
              <div className="button-row">
                <button className="button subtle" type="button" onClick={() => checkReviewerJson(jsonText)}>
                  <FileJson size={17} aria-hidden="true" />
                  Check
                </button>
                <button className="button primary" type="button" onClick={() => saveReviewerJson(jsonText)}>
                  <Save size={17} aria-hidden="true" />
                  Save Reviewer
                </button>
              </div>
            </div>
          ) : null}

          {errors.length ? (
            <div className="generator-errors" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <details className="advanced-panel">
            <summary>Advanced JSON Import</summary>
            <div className="generator-panel-head compact">
              <FileJson size={20} aria-hidden="true" />
              <div>
                <h2>Paste or Load Reviewer JSON</h2>
                <p className="muted">Use this only if you already have reviewer JSON from somewhere else.</p>
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
          </details>

          <details className="advanced-panel">
            <summary>Manual Builder</summary>
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
          </details>
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
                  <span>1. Paste material</span>
                  <p>Copy text from your notes, handout, or PDF and paste it into the Study Material box.</p>
                </article>
                <article>
                  <span>2. Generate</span>
                  <p>Gemini creates multiple-choice questions using only the pasted material.</p>
                </article>
                <article>
                  <span>3. Save</span>
                  <p>Save the reviewer offline so it appears on the home page and works for quizzes.</p>
                </article>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
