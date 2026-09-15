import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileJson, FileText, Loader2, Plus, RotateCcw, Save, Sparkles, Upload, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { validateReviewer } from "../data/reviewerRegistry.js";
import { upsertCloudReviewer } from "../services/cloudReviewers.js";
import { clearGeneratorDraft, getCloudReviewerCache, getGeneratorDraft, saveCloudReviewerCache, saveGeneratorDraft, saveLocalReviewer } from "../utils/storageUtils.js";

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

const TEXT_FILE_EXTENSIONS = [".txt", ".md", ".csv", ".json"];
const MAX_UPLOAD_SIZE = 12 * 1024 * 1024;
const MAX_AI_FILE_UPLOAD_SIZE = 3 * 1024 * 1024;
const MAX_AI_SOURCE_TEXT_LENGTH = 45000;
const QUESTION_COUNT_OPTIONS = [
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "75", label: "75" },
  { value: "100", label: "100" },
  { value: "comprehensive", label: "Comprehensive" }
];
const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "mixed", label: "Mixed" },
  { value: "hard", label: "Hard" }
];
const QUESTION_TYPE_OPTIONS = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "identification", label: "Identification" },
  { value: "true_false", label: "True / False" },
  { value: "flashcard", label: "Flashcards" }
];
const MORE_QUESTION_COUNT_OPTIONS = [
  { value: "10", label: "+10" },
  { value: "20", label: "+20" },
  { value: "50", label: "+50" }
];

function isPdfFile(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

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
    type: "multiple_choice",
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

function normalizeReviewerJson(reviewer, options = {}) {
  const questions = Array.isArray(reviewer?.questions) ? reviewer.questions : [];
  const reviewerQuestionType = QUESTION_TYPE_OPTIONS.some((option) => option.value === reviewer?.questionType)
    ? reviewer.questionType
    : options.questionType || "multiple_choice";
  const normalizedQuestions = questions.map((question, index) => {
    const type = QUESTION_TYPE_OPTIONS.some((option) => option.value === question.type)
      ? question.type
      : reviewerQuestionType;
    const isTyped = type === "identification" || type === "flashcard";
    const validAnswers = type === "true_false" ? ["A", "B"] : isTyped ? ["TEXT"] : ["A", "B", "C", "D"];
    const rawCorrectAnswer = String(question.correctAnswer || (isTyped ? "TEXT" : "A")).toUpperCase();
    const correctAnswer = validAnswers.includes(rawCorrectAnswer) ? rawCorrectAnswer : validAnswers[0];
    const choices = question.choices || {};
    const normalizedChoices = type === "true_false"
      ? {
          A: choices.A || "True",
          B: choices.B || "False",
          C: "",
          D: ""
        }
      : {
          A: choices.A || "",
          B: choices.B || "",
          C: choices.C || "",
          D: choices.D || ""
        };

    return {
      id: question.id || index + 1,
      type,
      topic: question.topic || "Generated Reviewer",
      question: question.question || "",
      choices: normalizedChoices,
      correctAnswer,
      answerText: question.answerText || normalizedChoices[correctAnswer] || "",
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
    reviewerId: options.preserveReviewerId && reviewer?.reviewerId
      ? reviewer.reviewerId
      : `${slugify(reviewer?.reviewerId || title || subject || "generated-reviewer")}-${Date.now()}`,
    title,
    subject,
    coverage,
    questionCount: normalizedQuestions.length,
    questionType: reviewerQuestionType,
    choicesPerQuestion: reviewerQuestionType === "multiple_choice" ? 4 : reviewerQuestionType === "true_false" ? 2 : 0,
    instructions: reviewer?.instructions || "Select the best answer for each question.",
    questions: normalizedQuestions
  };
}

function getFriendlyGenerationError(error) {
  const message = error?.message || "";
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("expected pattern") ||
    lowerMessage.includes("function_payload_too_large") ||
    lowerMessage.includes("payload too large") ||
    lowerMessage.includes("413")
  ) {
    return "That file is too large to send to the AI after browser encoding. Compress or split the PDF, or paste the important notes into Extra Notes.";
  }

  return message || "Could not generate a reviewer.";
}

async function extractPdfText(file) {
  if (!Promise.withResolvers) {
    Promise.withResolvers = function withResolvers() {
      let resolve;
      let reject;
      const promise = new Promise((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
      });

      return { promise, resolve, reject };
    };
  }

  const [pdfjsLib, pdfWorker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => item.str || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) pageTexts.push(`Page ${pageNumber}: ${text}`);
    if (pageTexts.join("\n\n").length >= MAX_AI_SOURCE_TEXT_LENGTH) break;
  }

  return pageTexts.join("\n\n").slice(0, MAX_AI_SOURCE_TEXT_LENGTH);
}

export default function Generator() {
  const navigate = useNavigate();
  const { configured, user } = useAuth();
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
  const [targetQuestionCount, setTargetQuestionCount] = useState(savedDraft?.targetQuestionCount || "50");
  const [difficulty, setDifficulty] = useState(savedDraft?.difficulty || "mixed");
  const [questionType, setQuestionType] = useState(savedDraft?.questionType || "multiple_choice");
  const [moreQuestionCount, setMoreQuestionCount] = useState(savedDraft?.moreQuestionCount || "20");
  const [saveOfflineCopy, setSaveOfflineCopy] = useState(savedDraft?.saveOfflineCopy || false);
  const [studyFile, setStudyFile] = useState(null);
  const [jsonText, setJsonText] = useState(savedDraft?.jsonText || "");
  const [errors, setErrors] = useState([]);
  const [jsonCheck, setJsonCheck] = useState(null);
  const [savedReviewer, setSavedReviewer] = useState(null);
  const [generationStats, setGenerationStats] = useState(null);
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationSteps, setGenerationSteps] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingQuestions, setIsAddingQuestions] = useState(false);
  const [isSavingReviewer, setIsSavingReviewer] = useState(false);
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
      targetQuestionCount,
      difficulty,
      questionType,
      moreQuestionCount,
      saveOfflineCopy,
      jsonText
    });
    setDraftMessage("Draft saved on this device.");
  }, [details, questionDraft, questions, sourceText, targetQuestionCount, difficulty, questionType, moreQuestionCount, saveOfflineCopy, jsonText]);

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

  function setProgressStep(step) {
    setGenerationSteps((current) => current.includes(step) ? current : [...current, step]);
  }

  function getCurrentReviewerFromJson({ preserveReviewerId = false } = {}) {
    if (!jsonText) return null;
    return normalizeReviewerJson(JSON.parse(jsonText), { preserveReviewerId, questionType });
  }

  function isTextFile(file) {
    const fileName = file.name.toLowerCase();
    return file.type.startsWith("text/") || TEXT_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsText(file);
    });
  }

  async function handleStudyFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE) {
      setErrors(["That file is too large. Use a file under 12 MB or paste the important text."]);
      return;
    }

    setErrors([]);
    setGenerationSteps([]);
    setGenerationMessage(isPdfFile(file) && file.size > MAX_AI_FILE_UPLOAD_SIZE ? "Large PDF detected. Extracting text in your browser..." : "");

    try {
      if (isTextFile(file)) {
        const text = await readFileAsText(file);
        setSourceText(text);
        setStudyFile({
          name: file.name,
          mimeType: file.type || "text/plain",
          size: file.size,
          data: null
        });
        setGenerationMessage("Text file loaded.");
        return;
      }

      if (file.size > MAX_AI_FILE_UPLOAD_SIZE) {
        if (!isPdfFile(file)) {
          setStudyFile(null);
          setErrors(["That file is too large for AI upload on Vercel. Use a smaller file or paste the important notes into Extra Notes."]);
          return;
        }

        setProgressStep("Extracting PDF text");
        const extractedText = await extractPdfText(file);

        if (extractedText.length < 100) {
          setStudyFile(null);
          setErrors(["That PDF is too large to upload and the app could not extract enough readable text. It may be scanned images. Compress/split it, OCR it, or paste the important notes into Extra Notes."]);
          setGenerationMessage("");
          return;
        }

        setSourceText(extractedText);
        setStudyFile({
          name: `${file.name} (text extracted)`,
          mimeType: "text/plain",
          size: file.size,
          data: null
        });
        setGenerationMessage(`Extracted text from ${file.name}. Gemini will use the text instead of uploading the large PDF.`);
        setProgressStep("PDF text ready");
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      const [, base64Data = ""] = dataUrl.split(",");
      setStudyFile({
        name: file.name,
        mimeType: file.type || "application/pdf",
        size: file.size,
        data: base64Data
      });
      setGenerationMessage("File ready for Gemini.");
    } catch (error) {
      setStudyFile(null);
      setErrors([error?.message || "Could not read that file."]);
    }
  }

  function removeStudyFile() {
    setStudyFile(null);
    setGenerationMessage("");
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

  async function persistReviewer(reviewer, { saveOffline = false } = {}) {
    if (configured && user) {
      const { error } = await upsertCloudReviewer(user.id, reviewer);

      if (error) {
        throw new Error(`Cloud save failed: ${error.message || "Unknown error"}`);
      }

      const cachedReviewers = getCloudReviewerCache().filter((item) => item.reviewerId !== reviewer.reviewerId);
      saveCloudReviewerCache([reviewer, ...cachedReviewers]);

      if (saveOffline) {
        saveLocalReviewer(reviewer);
        return "cloud-and-offline";
      }

      return "cloud";
    }

    saveLocalReviewer(reviewer);
    return "offline";
  }

  function getSaveMessage(saveMode) {
    if (saveMode === "cloud-and-offline") return "Reviewer saved to cloud and this device.";
    if (saveMode === "cloud") return "Reviewer saved to cloud.";
    return "Reviewer saved offline on this device.";
  }

  async function saveDraftReviewer() {
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

    setIsSavingReviewer(true);

    try {
      await persistReviewer(reviewer, { saveOffline: saveOfflineCopy });
      clearGeneratorDraft();
      navigate(`/reviewer/${reviewer.reviewerId}`);
    } catch (error) {
      setErrors([error?.message || "Could not save reviewer."]);
    } finally {
      setIsSavingReviewer(false);
    }
  }

  async function saveReviewerJson(rawJson) {
    try {
      const parsedReviewer = JSON.parse(rawJson);
      const reviewer = normalizeReviewerJson(parsedReviewer);
      const validation = validateReviewer(reviewer);

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      setIsSavingReviewer(true);
      const saveMode = await persistReviewer(reviewer, { saveOffline: saveOfflineCopy });
      clearGeneratorDraft();
      setSavedReviewer({ reviewerId: reviewer.reviewerId, saveMode });
      setGenerationMessage(getSaveMessage(saveMode));
    } catch (error) {
      setErrors([error?.message || "Paste valid reviewer JSON before saving."]);
    } finally {
      setIsSavingReviewer(false);
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

  async function generateReviewerWithAi({ regenerate = false } = {}) {
    const trimmedSourceText = sourceText.trim().slice(0, MAX_AI_SOURCE_TEXT_LENGTH);
    const hasUploadedFile = Boolean(studyFile?.data);

    if (!isOnline) {
      setErrors(["Connect to the internet before using Gemini generation."]);
      return;
    }

    if (!hasUploadedFile && trimmedSourceText.length < 100) {
      setErrors(["Upload a study file or paste more study material before generating a reviewer."]);
      return;
    }

    setIsGenerating(true);
    setErrors([]);
    setJsonCheck(null);
    setSavedReviewer(null);
    setGenerationStats(null);
    setGenerationSteps(["Preparing study material"]);
    setGenerationMessage(regenerate ? "Regenerating reviewer with Gemini..." : "Generating reviewer with Gemini...");

    try {
      setProgressStep("Sending material to Gemini");
      const response = await fetch("/api/generate-reviewer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceText: trimmedSourceText,
          file: hasUploadedFile
            ? {
                name: studyFile.name,
                mimeType: studyFile.mimeType,
                data: studyFile.data
              }
            : null,
          title: details.title,
          subject: details.subject,
          instructions: details.instructions,
          questionCount: targetQuestionCount,
          difficulty,
          questionType
        })
      });
      setProgressStep("Reading Gemini response");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Gemini could not generate a reviewer.");
      }

      const reviewer = normalizeReviewerJson(data.reviewer, { questionType });
      const validation = validateReviewer(reviewer);

      if (!validation.isValid) {
        throw new Error(validation.errors[0] || "Gemini generated an invalid reviewer.");
      }

      setProgressStep("Saving reviewer");
      const saveMode = await persistReviewer(reviewer, { saveOffline: saveOfflineCopy });
      const nextJsonText = JSON.stringify(reviewer, null, 2);
      updateJsonText(nextJsonText);
      checkReviewerJson(nextJsonText);
      skipNextAutosave.current = true;
      clearGeneratorDraft();
      setSavedReviewer({ reviewerId: reviewer.reviewerId, saveMode });
      setGenerationStats({
        requested: data.requestedQuestionCount || targetQuestionCount,
        generated: data.generatedQuestionCount || reviewer.questions.length,
        warning: data.warning || ""
      });
      setGenerationMessage(data.warning
        ? `${data.warning} ${getSaveMessage(saveMode)}`
        : `Reviewer generated with ${reviewer.questions.length} questions. ${getSaveMessage(saveMode)}`);
      setProgressStep("Done");
    } catch (error) {
      setGenerationMessage("");
      setErrors([getFriendlyGenerationError(error)]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function makeMoreQuestions() {
    const trimmedSourceText = sourceText.trim().slice(0, MAX_AI_SOURCE_TEXT_LENGTH);
    const hasUploadedFile = Boolean(studyFile?.data);

    if (!isOnline) {
      setErrors(["Connect to the internet before asking Gemini for more questions."]);
      return;
    }

    let currentReviewer;
    try {
      currentReviewer = getCurrentReviewerFromJson({ preserveReviewerId: true });
    } catch {
      setErrors(["Generate a valid reviewer before making more questions."]);
      return;
    }

    if (!currentReviewer?.questions?.length) {
      setErrors(["Generate a reviewer before making more questions."]);
      return;
    }

    if (currentReviewer.questions.length >= 150) {
      setErrors(["This reviewer already has 150 questions, which is the current maximum."]);
      return;
    }

    setIsAddingQuestions(true);
    setErrors([]);
    setGenerationSteps(["Preparing existing reviewer", "Sending request for more questions"]);
    setGenerationMessage(`Making ${moreQuestionCount} more questions with Gemini...`);

    try {
      const response = await fetch("/api/generate-reviewer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "extend",
          sourceText: trimmedSourceText,
          file: hasUploadedFile
            ? {
                name: studyFile.name,
                mimeType: studyFile.mimeType,
                data: studyFile.data
              }
            : null,
          title: currentReviewer.title || details.title,
          subject: currentReviewer.subject || details.subject,
          instructions: currentReviewer.instructions || details.instructions,
          difficulty,
          questionType: currentReviewer.questionType || questionType,
          additionalCount: moreQuestionCount,
          existingReviewer: currentReviewer
        })
      });
      setProgressStep("Checking new questions");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Gemini could not make more questions.");
      }

      const reviewer = normalizeReviewerJson(data.reviewer, { preserveReviewerId: true, questionType: currentReviewer.questionType || questionType });
      const validation = validateReviewer(reviewer);

      if (!validation.isValid) {
        throw new Error(validation.errors[0] || "Gemini generated invalid additional questions.");
      }

      setProgressStep("Saving expanded reviewer");
      const saveMode = await persistReviewer(reviewer, { saveOffline: saveOfflineCopy });
      const nextJsonText = JSON.stringify(reviewer, null, 2);
      updateJsonText(nextJsonText);
      checkReviewerJson(nextJsonText);
      setSavedReviewer({ reviewerId: reviewer.reviewerId, saveMode });
      setGenerationStats({
        requested: data.requestedQuestionCount || reviewer.questions.length,
        generated: data.generatedQuestionCount || reviewer.questions.length,
        warning: data.warning || ""
      });
      setGenerationMessage(data.warning
        ? `${data.warning} ${getSaveMessage(saveMode)}`
        : `Added ${data.addedQuestionCount || moreQuestionCount} questions. ${getSaveMessage(saveMode)}`);
      setProgressStep("Done");
    } catch (error) {
      setGenerationMessage("");
      setErrors([getFriendlyGenerationError(error)]);
    } finally {
      setIsAddingQuestions(false);
    }
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
    setTargetQuestionCount("50");
    setDifficulty("mixed");
    setQuestionType("multiple_choice");
    setMoreQuestionCount("20");
    setSaveOfflineCopy(false);
    setStudyFile(null);
    setJsonText("");
    setErrors([]);
    setJsonCheck(null);
    setSavedReviewer(null);
    setGenerationStats(null);
    setGenerationSteps([]);
    setDraftMessage("Draft cleared.");
  }

  return (
    <div className="page generator-page">
      <section className="section-heading">
        <div>
          <p className="eyebrow">AI Generator</p>
          <h1>Generate a reviewer</h1>
          <p className="muted">Upload study material, generate a reviewer with Gemini, then save it for offline study.</p>
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
              <p className="muted">Upload a PDF or text file. You can also paste notes if that is faster.</p>
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

            <fieldset className="generator-option-group">
              <legend>Number of Questions</legend>
              <div className="segmented">
                {QUESTION_COUNT_OPTIONS.map((option) => (
                  <button
                    className={targetQuestionCount === option.value ? "active" : ""}
                    type="button"
                    key={option.value}
                    onClick={() => setTargetQuestionCount(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="generator-option-group">
              <legend>Difficulty</legend>
              <div className="segmented compact">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    className={difficulty === option.value ? "active" : ""}
                    type="button"
                    key={option.value}
                    onClick={() => setDifficulty(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="generator-option-group">
              <legend>Question Type</legend>
              <div className="segmented">
                {QUESTION_TYPE_OPTIONS.map((option) => (
                  <button
                    className={questionType === option.value ? "active" : ""}
                    type="button"
                    key={option.value}
                    onClick={() => setQuestionType(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="upload-zone ai-upload-zone">
              <input type="file" accept=".pdf,.txt,.md,.csv,.json,text/plain,application/pdf" onChange={handleStudyFile} />
              <Upload size={30} aria-hidden="true" />
              <strong>{studyFile ? studyFile.name : "Upload study material"}</strong>
              <span>{studyFile ? `${(studyFile.size / 1024 / 1024).toFixed(2)} MB ready` : "PDF under 3 MB, or TXT, MD, CSV, JSON. Text files will also fill the notes box below."}</span>
            </label>

            {studyFile ? (
              <div className="button-row">
                <button className="button subtle" type="button" onClick={removeStudyFile}>
                  Remove File
                </button>
              </div>
            ) : null}

            <label className="prompt-box">
              <span>Extra Notes</span>
              <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Optional: paste notes here, or use this instead of uploading a file." />
            </label>
            {configured && user ? (
              <label className="generator-checkbox">
                <input
                  type="checkbox"
                  checked={saveOfflineCopy}
                  onChange={(event) => setSaveOfflineCopy(event.target.checked)}
                />
                <span>Also save an offline copy on this device</span>
              </label>
            ) : null}
            <div className="button-row">
              <button className="button primary" type="button" onClick={generateReviewerWithAi} disabled={isGenerating || isAddingQuestions || !isOnline}>
                {isGenerating ? <Loader2 size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
                {isGenerating ? "Generating..." : "Generate with Gemini"}
              </button>
              {generationMessage ? <span className="template-message">{generationMessage}</span> : null}
            </div>

            {generationSteps.length ? (
              <ol className="generation-progress" aria-label="Generation progress">
                {generationSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
          </div>

          {jsonText ? (
            <div className="json-import-panel">
              <div className="generator-panel-head compact">
                <FileJson size={20} aria-hidden="true" />
                <div>
                  <h2>Generated Reviewer</h2>
                  <p className="muted">This reviewer passed the app's JSON structure check.</p>
                </div>
              </div>
              {jsonCheck ? (
                <div className="json-check-card" role="status">
                  <strong>{jsonCheck.title}</strong>
                  <span>{jsonCheck.subject}</span>
                  <span>{jsonCheck.questions} questions across {jsonCheck.coverage} coverage areas</span>
                  {generationStats ? (
                    <span>
                      Requested {generationStats.requested}; generated {generationStats.generated}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="more-question-tools">
                <fieldset className="generator-option-group">
                  <legend>Make More Questions</legend>
                  <div className="segmented compact">
                    {MORE_QUESTION_COUNT_OPTIONS.map((option) => (
                      <button
                        className={moreQuestionCount === option.value ? "active" : ""}
                        type="button"
                        key={option.value}
                        onClick={() => setMoreQuestionCount(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <button
                  className="button subtle"
                  type="button"
                  onClick={makeMoreQuestions}
                  disabled={isGenerating || isAddingQuestions || !isOnline}
                >
                  {isAddingQuestions ? <Loader2 size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
                  {isAddingQuestions ? "Adding..." : "Add Questions"}
                </button>
              </div>
              <div className="button-row">
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => generateReviewerWithAi({ regenerate: true })}
                  disabled={isGenerating || isAddingQuestions || !isOnline}
                >
                  {isGenerating ? <Loader2 size={17} aria-hidden="true" /> : <RotateCcw size={17} aria-hidden="true" />}
                  Regenerate
                </button>
                {savedReviewer ? (
                  <button className="button primary" type="button" onClick={() => navigate(`/reviewer/${savedReviewer.reviewerId}`)}>
                    Open Reviewer
                  </button>
                ) : (
                  <button className="button primary" type="button" onClick={() => saveReviewerJson(jsonText)} disabled={isSavingReviewer}>
                    {isSavingReviewer ? <Loader2 size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                    {isSavingReviewer ? "Saving..." : configured && user ? "Save to Cloud" : "Save Offline"}
                  </button>
                )}
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

            <button className="button primary large" type="button" onClick={saveDraftReviewer} disabled={isSavingReviewer}>
              {isSavingReviewer ? <Loader2 size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
              {isSavingReviewer ? "Saving..." : configured && user ? "Save Manual to Cloud & Offline" : "Save Manual Offline"}
            </button>
          </details>
        </div>
      </section>
    </div>
  );
}
