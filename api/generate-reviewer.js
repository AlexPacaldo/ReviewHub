const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MAX_SOURCE_LENGTH = 45000;
const MAX_FILE_BASE64_LENGTH = 4200000;
const MAX_COMPLETION_ATTEMPTS = 3;
const DIFFICULTY_INSTRUCTIONS = {
  easy: "Favor direct recall, simple definitions, and straightforward concept checks.",
  mixed: "Use a balanced mix of recall, concept, scenario, and application questions.",
  hard: "Favor deeper application, scenario analysis, tricky-but-fair distinctions, and synthesis across related ideas."
};

const reviewerSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    subject: { type: "STRING" },
    coverage: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    questionCount: { type: "INTEGER" },
    questionType: { type: "STRING" },
    choicesPerQuestion: { type: "INTEGER" },
    instructions: { type: "STRING" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          topic: { type: "STRING" },
          question: { type: "STRING" },
          choices: {
            type: "OBJECT",
            properties: {
              A: { type: "STRING" },
              B: { type: "STRING" },
              C: { type: "STRING" },
              D: { type: "STRING" }
            },
            required: ["A", "B", "C", "D"]
          },
          correctAnswer: { type: "STRING" },
          answerText: { type: "STRING" },
          explanation: { type: "STRING" }
        },
        required: ["id", "topic", "question", "choices", "correctAnswer", "answerText", "explanation"]
      }
    }
  },
  required: ["title", "subject", "coverage", "questionCount", "questionType", "choicesPerQuestion", "instructions", "questions"]
};

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function getCandidateText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
}

function getQuestionCountInstruction(questionCount) {
  if (questionCount === "comprehensive") {
    return "Create enough questions to comprehensively cover the important material. Do not create repetitive filler questions.";
  }

  return `Create exactly ${questionCount} questions. Returning fewer than ${questionCount} questions is only acceptable when the source is an existing quiz with fewer readable questions. If the material is a handout, module, slide deck, PDF, or lecture file, generate the full ${questionCount} questions by covering different facts, concepts, examples, and applications from across the material.`;
}

function getDifficultyInstruction(difficulty) {
  return DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.mixed;
}

function buildPrompt({ sourceText, title, subject, instructions, questionCount, difficulty, fileName }) {
  const questionCountInstruction = getQuestionCountInstruction(questionCount);
  const difficultyInstruction = getDifficultyInstruction(difficulty);

  return `Create a complete multiple-choice reviewer from ONLY the study material below.

SOURCE RULES:
- Use the uploaded file and pasted study material as the only source of truth.
- Read the whole file before creating questions.
- Preserve terminology used in the material.
- Do not add facts from general knowledge.
- Do not use the internet.
- If something is not supported by the material, do not make it a question.
- Cover important material throughout the file, not only the first pages.
- Include definitions, examples, lists, comparisons, people, dates, frameworks, processes, stages, technologies, terminology, and important numbers when relevant.
- Avoid creating several questions that test the exact same fact.

IF THE MATERIAL IS ALREADY A QUIZ:
- Convert all readable multiple-choice questions into the JSON format.
- Preserve original question wording as closely as possible.
- Preserve original answer choices and A/B/C/D positions unless there is a clear formatting issue.
- If answers are visibly marked, record those answers.
- Do not invent unreadable or missing text.

IF THE MATERIAL IS A HANDOUT, MODULE, OR STUDY MATERIAL:
- Create a useful exam reviewer, not copied sentences.
- Include a mixture of definitions, concepts, comparisons, scenarios, applications, processes, stages, examples, frameworks, important numbers, people, dates, technologies, and terminology.
- ${questionCountInstruction}
- Do not stop after a short sample. Produce the complete questions array requested by the selected question count whenever the material supports it.
- If the selected question count is a number, treat that number as the required final size of the questions array.
- Only create fewer questions when the source is truly too short or unreadable, and never invent facts.

DIFFICULTY:
- ${difficultyInstruction}
- Keep every question fair and answerable from the study material.

MULTIPLE-CHOICE RULES:
- Every question must have exactly 4 choices: A, B, C, and D.
- Every question must have exactly one correct answer.
- Wrong answers must be believable, related to the same topic, and clearly incorrect according to the material.
- Do not use "All of the above", "None of the above", or "Both A and B" unless those exact choices already exist in an original quiz.
- correctAnswer must be only "A", "B", "C", or "D".
- answerText must exactly match choices[correctAnswer].
- Include a short, source-supported explanation for every question.

ANSWER POSITION RULES:
- If you are generating new questions from study material, randomize correct answer positions.
- Use A, B, C, and D throughout the reviewer.
- Distribute correct answers as evenly as reasonably possible.
- Do not make one letter the correct answer most of the time.
- Do not create an obvious repeating pattern such as A, B, C, D, A, B, C, D.
- Shuffle choices after deciding the correct answer, then update correctAnswer and answerText.
- If the material is already an existing quiz, preserve original A/B/C/D positions.

JSON RULES:
- Return valid JSON only.
- Do not wrap the answer in markdown.
- Follow the exact schema requested by the API.
- reviewerId must be lowercase, URL-friendly, and use hyphens.
- questionCount must exactly equal questions.length.
- Question IDs must start at 1 and be sequential.
- coverage must list major topics covered by the material.
- topic must be useful for every question.

FINAL SELF-CHECK BEFORE RETURNING JSON:
- Valid JSON syntax.
- questionCount matches the number of questions.
- IDs are sequential with no duplicates.
- Every question has choices A, B, C, and D.
- Every correctAnswer exists in choices.
- Every answerText exactly equals choices[correctAnswer].
- Every question has a topic and explanation.
- No obvious duplicate questions.
- For generated questions, correct-answer positions are reasonably balanced and not patterned.

Reviewer details:
- Title: ${title || "Generated Reviewer"}
- Subject: ${subject || "Generated"}
- Instructions: ${instructions || "Select the best answer for each question."}
- Difficulty: ${difficulty || "mixed"}
${fileName ? `- Uploaded file: ${fileName}` : ""}

Study material:
${sourceText || "[Use the uploaded file as the study material.]"}`;
}

function buildCompletionPrompt({ sourceText, title, subject, instructions, difficulty, requestedCount, missingCount, existingQuestions, fileName }) {
  const existingSummary = existingQuestions
    .map((question) => `${question.id}. ${question.topic}: ${question.question}`)
    .join("\n")
    .slice(0, 16000);
  const difficultyInstruction = getDifficultyInstruction(difficulty);

  return `You are completing a multiple-choice reviewer that came back with too few questions.

Create exactly ${missingCount} NEW additional multiple-choice questions so the final reviewer reaches exactly ${requestedCount} questions.

SOURCE RULES:
- Use ONLY the same study material below and the uploaded file if present.
- Do not use the internet or outside knowledge.
- Cover parts of the material that are not already represented.
- Do not duplicate or rephrase the existing questions listed below.
- Every new question must be source-supported.

DIFFICULTY:
- ${difficultyInstruction}
- Keep every question fair and answerable from the study material.

MULTIPLE-CHOICE RULES:
- Every question must have exactly 4 choices: A, B, C, and D.
- Every question must have exactly one correct answer.
- correctAnswer must be only "A", "B", "C", or "D".
- answerText must exactly match choices[correctAnswer].
- Include a short, source-supported explanation for every question.
- Use varied correct-answer positions with no obvious pattern.

JSON RULES:
- Return a complete reviewer JSON object using the API schema.
- The returned questions array must contain exactly ${missingCount} new questions.
- Use question IDs starting at 1 inside this completion response.
- questionCount must equal ${missingCount}.

Reviewer details:
- Title: ${title || "Generated Reviewer"}
- Subject: ${subject || "Generated"}
- Instructions: ${instructions || "Select the best answer for each question."}
- Difficulty: ${difficulty || "mixed"}
${fileName ? `- Uploaded file: ${fileName}` : ""}

Existing questions to avoid:
${existingSummary || "[No existing questions listed.]"}

Study material:
${sourceText || "[Use the uploaded file as the study material.]"}`;
}

function getNumericTarget(questionCount) {
  if (questionCount === "comprehensive") return null;
  const count = Number(questionCount);
  if (!Number.isFinite(count)) return null;
  return Math.max(1, Math.min(150, Math.round(count)));
}

function normalizeGeneratedReviewer(reviewer, fallback = {}) {
  const questions = Array.isArray(reviewer?.questions) ? reviewer.questions : [];
  const normalizedQuestions = questions.map((question, index) => {
    const choices = question?.choices || {};
    const correctAnswer = ["A", "B", "C", "D"].includes(String(question?.correctAnswer || "").toUpperCase())
      ? String(question.correctAnswer).toUpperCase()
      : "A";

    return {
      id: index + 1,
      topic: String(question?.topic || fallback.subject || "Generated Reviewer").trim(),
      question: String(question?.question || "").trim(),
      choices: {
        A: String(choices.A || "").trim(),
        B: String(choices.B || "").trim(),
        C: String(choices.C || "").trim(),
        D: String(choices.D || "").trim()
      },
      correctAnswer,
      answerText: String(question?.answerText || choices[correctAnswer] || "").trim(),
      explanation: String(question?.explanation || "").trim()
    };
  });
  const coverage = Array.isArray(reviewer?.coverage) && reviewer.coverage.length
    ? reviewer.coverage
    : [...new Set(normalizedQuestions.map((question) => question.topic).filter(Boolean))];

  return {
    ...reviewer,
    title: reviewer?.title || fallback.title || "Generated Reviewer",
    subject: reviewer?.subject || fallback.subject || "Generated",
    coverage,
    questionCount: normalizedQuestions.length,
    questionType: "multiple_choice",
    choicesPerQuestion: 4,
    instructions: reviewer?.instructions || fallback.instructions || "Select the best answer for each question.",
    questions: normalizedQuestions
  };
}

function mergeReviewers(baseReviewer, additionalReviewer, requestedCount) {
  const mergedQuestions = [
    ...(baseReviewer.questions || []),
    ...(additionalReviewer.questions || [])
  ].slice(0, requestedCount).map((question, index) => ({
    ...question,
    id: index + 1
  }));
  const coverage = [...new Set([
    ...(baseReviewer.coverage || []),
    ...(additionalReviewer.coverage || []),
    ...mergedQuestions.map((question) => question.topic)
  ].filter(Boolean))];

  return {
    ...baseReviewer,
    coverage,
    questionCount: mergedQuestions.length,
    questions: mergedQuestions
  };
}

async function requestReviewerFromGemini({ apiKey, model, parts }) {
  const geminiResponse = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts
        }
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 32768,
        response_mime_type: "application/json",
        response_schema: reviewerSchema
      }
    })
  });

  const data = await geminiResponse.json();

  if (!geminiResponse.ok) {
    const message = data?.error?.message || "Gemini could not generate a reviewer.";
    const error = new Error(message);
    error.statusCode = geminiResponse.status;
    throw error;
  }

  const text = getCandidateText(data);
  if (!text) {
    const error = new Error("Gemini returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Gemini returned invalid JSON.");
    error.statusCode = 502;
    error.rawText = text;
    throw error;
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendJson(response, 500, { error: "GEMINI_API_KEY is not configured." });
  }

  const {
    sourceText = "",
    file = null,
    title = "",
    subject = "",
    instructions = "Select the best answer for each question.",
    questionCount = 50,
    difficulty = "mixed",
    mode = "generate",
    existingReviewer = null,
    additionalCount = 20
  } = request.body || {};

  const trimmedSourceText = String(sourceText).trim();
  const hasFileData = Boolean(file?.data && file?.mimeType);
  const normalizedMode = mode === "extend" ? "extend" : "generate";
  const safeDifficulty = DIFFICULTY_INSTRUCTIONS[difficulty] ? difficulty : "mixed";
  const existingQuestions = Array.isArray(existingReviewer?.questions) ? existingReviewer.questions : [];

  if (!hasFileData && trimmedSourceText.length < 100 && !existingQuestions.length) {
    return sendJson(response, 400, { error: "Add more study material before generating a reviewer." });
  }

  if (hasFileData && String(file.data).length > MAX_FILE_BASE64_LENGTH) {
    return sendJson(response, 413, { error: "That file is too large to send to the AI after browser encoding. Compress or split the PDF, or paste the important notes." });
  }

  const safeSourceText = trimmedSourceText.slice(0, MAX_SOURCE_LENGTH);
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const parsedAdditionalCount = Math.max(1, Math.min(75, Number(additionalCount) || 20));
  const parsedQuestionCount = questionCount === "comprehensive"
    ? "comprehensive"
    : Math.max(1, Math.min(150, Number(questionCount) || 50));

  if (normalizedMode === "extend") {
    if (!existingQuestions.length) {
      return sendJson(response, 400, { error: "Choose a generated reviewer before making more questions." });
    }

    const baseReviewer = normalizeGeneratedReviewer(existingReviewer, {
      title: String(title).trim(),
      subject: String(subject).trim(),
      instructions: String(instructions).trim()
    });
    const requestedCount = Math.min(150, baseReviewer.questions.length + parsedAdditionalCount);
    const prompt = buildCompletionPrompt({
      sourceText: safeSourceText || JSON.stringify(baseReviewer.questions),
      title: baseReviewer.title,
      subject: baseReviewer.subject,
      instructions: baseReviewer.instructions,
      difficulty: safeDifficulty,
      requestedCount,
      missingCount: requestedCount - baseReviewer.questions.length,
      existingQuestions: baseReviewer.questions,
      fileName: file?.name ? String(file.name).trim() : ""
    });
    const parts = [{ text: prompt }];

    if (hasFileData) {
      parts.push({
        inline_data: {
          mime_type: String(file.mimeType),
          data: String(file.data)
        }
      });
    }

    try {
      const additionalReviewer = normalizeGeneratedReviewer(await requestReviewerFromGemini({
        apiKey,
        model,
        parts
      }), {
        title: baseReviewer.title,
        subject: baseReviewer.subject,
        instructions: baseReviewer.instructions
      });
      const reviewer = {
        ...mergeReviewers(baseReviewer, additionalReviewer, requestedCount),
        reviewerId: existingReviewer.reviewerId || baseReviewer.reviewerId
      };

      return sendJson(response, 200, {
        reviewer,
        requestedQuestionCount: requestedCount,
        generatedQuestionCount: reviewer.questions.length,
        addedQuestionCount: Math.max(0, reviewer.questions.length - baseReviewer.questions.length),
        warning: reviewer.questions.length < requestedCount
          ? `Gemini added ${Math.max(0, reviewer.questions.length - baseReviewer.questions.length)} of ${requestedCount - baseReviewer.questions.length} requested new questions.`
          : null
      });
    } catch (error) {
      return sendJson(response, error?.statusCode || 500, {
        error: error?.message || "Could not reach Gemini.",
        rawText: error?.rawText
      });
    }
  }

  const prompt = buildPrompt({
    sourceText: safeSourceText,
    title: String(title).trim(),
    subject: String(subject).trim(),
    instructions: String(instructions).trim(),
    questionCount: parsedQuestionCount,
    difficulty: safeDifficulty,
    fileName: file?.name ? String(file.name).trim() : ""
  });
  const parts = [{ text: prompt }];

  if (hasFileData) {
    parts.push({
      inline_data: {
        mime_type: String(file.mimeType),
        data: String(file.data)
      }
    });
  }

  try {
    let reviewer = normalizeGeneratedReviewer(await requestReviewerFromGemini({
      apiKey,
      model,
      parts
    }), {
      title: String(title).trim(),
      subject: String(subject).trim(),
      instructions: String(instructions).trim()
    });

    const requestedCount = getNumericTarget(parsedQuestionCount);
    let completionAttempts = 0;

    while (requestedCount && reviewer.questions.length < requestedCount && completionAttempts < MAX_COMPLETION_ATTEMPTS) {
      completionAttempts += 1;
      const missingCount = requestedCount - reviewer.questions.length;
      const completionPrompt = buildCompletionPrompt({
        sourceText: safeSourceText,
        title: reviewer.title,
        subject: reviewer.subject,
        instructions: reviewer.instructions,
        difficulty: safeDifficulty,
        requestedCount,
        missingCount,
        existingQuestions: reviewer.questions,
        fileName: file?.name ? String(file.name).trim() : ""
      });
      const completionParts = [{ text: completionPrompt }];

      if (hasFileData) {
        completionParts.push({
          inline_data: {
            mime_type: String(file.mimeType),
            data: String(file.data)
          }
        });
      }

      const additionalReviewer = normalizeGeneratedReviewer(await requestReviewerFromGemini({
        apiKey,
        model,
        parts: completionParts
      }), {
        title: reviewer.title,
        subject: reviewer.subject,
        instructions: reviewer.instructions
      });

      if (!additionalReviewer.questions.length) break;
      reviewer = mergeReviewers(reviewer, additionalReviewer, requestedCount);
    }

    const warning = requestedCount && reviewer.questions.length < requestedCount
      ? `Gemini generated ${reviewer.questions.length} of ${requestedCount} requested questions after ${completionAttempts + 1} attempt${completionAttempts === 0 ? "" : "s"}. The source may be too short, unclear, or the model may have stopped early.`
      : null;

    return sendJson(response, 200, {
      reviewer,
      requestedQuestionCount: requestedCount || "comprehensive",
      generatedQuestionCount: reviewer.questions.length,
      warning
    });
  } catch (error) {
    return sendJson(response, error?.statusCode || 500, {
      error: error?.message || "Could not reach Gemini.",
      rawText: error?.rawText
    });
  }
}
