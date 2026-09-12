const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
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

function buildPrompt({ sourceText, title, subject, instructions, questionCount, fileName }) {
  return `Create a complete multiple-choice reviewer from ONLY the study material below.

Rules:
- Return valid JSON only.
- Do not wrap the answer in markdown.
- Follow the exact schema requested by the API.
- Use 4 choices per question: A, B, C, and D.
- correctAnswer must be one of A, B, C, or D.
- answerText must exactly match choices[correctAnswer].
- Include a short explanation for every question.
- Keep every question verifiable from the study material.
- If the material is short, create fewer high-quality questions instead of inventing facts.
- Prefer ${questionCount} questions when the material supports it.

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
    questionCount = 20
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
  const prompt = buildPrompt({
    sourceText: safeSourceText,
    title: String(title).trim(),
    subject: String(subject).trim(),
    instructions: String(instructions).trim(),
    questionCount: Number(questionCount) || 20,
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
