const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MAX_SOURCE_LENGTH = 45000;
const MAX_FILE_BASE64_LENGTH = 18000000;

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

  return `Create exactly ${questionCount} questions if the material contains enough information. If it does not, create fewer high-quality questions instead of inventing facts.`;
}

function buildPrompt({ sourceText, title, subject, instructions, questionCount, fileName }) {
  const questionCountInstruction = getQuestionCountInstruction(questionCount);

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
- Include a mixture of definitions, identification, concepts, comparisons, scenarios, applications, processes, stages, examples, frameworks, important numbers, people, dates, technologies, and terminology.
- ${questionCountInstruction}
- If the material is short, create fewer high-quality questions instead of inventing facts.

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
${fileName ? `- Uploaded file: ${fileName}` : ""}

Study material:
${sourceText || "[Use the uploaded file as the study material.]"}`;
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
    questionCount = 50
  } = request.body || {};

  const trimmedSourceText = String(sourceText).trim();
  const hasFileData = Boolean(file?.data && file?.mimeType);

  if (!hasFileData && trimmedSourceText.length < 100) {
    return sendJson(response, 400, { error: "Add more study material before generating a reviewer." });
  }

  if (hasFileData && String(file.data).length > MAX_FILE_BASE64_LENGTH) {
    return sendJson(response, 413, { error: "That file is too large. Try a smaller PDF or paste the important text." });
  }

  const safeSourceText = trimmedSourceText.slice(0, MAX_SOURCE_LENGTH);
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const parsedQuestionCount = questionCount === "comprehensive"
    ? "comprehensive"
    : Math.max(1, Math.min(150, Number(questionCount) || 50));
  const prompt = buildPrompt({
    sourceText: safeSourceText,
    title: String(title).trim(),
    subject: String(subject).trim(),
    instructions: String(instructions).trim(),
    questionCount: parsedQuestionCount,
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
          response_mime_type: "application/json",
          response_schema: reviewerSchema
        }
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return sendJson(response, geminiResponse.status, {
        error: data?.error?.message || "Gemini could not generate a reviewer."
      });
    }

    const text = getCandidateText(data);
    if (!text) {
      return sendJson(response, 502, { error: "Gemini returned an empty response." });
    }

    try {
      const reviewer = JSON.parse(text);
      return sendJson(response, 200, { reviewer });
    } catch {
      return sendJson(response, 502, { error: "Gemini returned invalid JSON.", rawText: text });
    }
  } catch (error) {
    return sendJson(response, 500, { error: error?.message || "Could not reach Gemini." });
  }
}
