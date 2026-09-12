import technoPrelim from "./reviewers/bm2506_technopreneurship_prelim_reviewer.json";
import technoPrelimReviewerFromMaam from "./reviewers/technopreneurship_quiz_50_questions_verified.json";
import { getCloudReviewerCache, getLocalReviewers } from "../utils/storageUtils.js";

const REQUIRED_CHOICE_KEYS = ["A", "B", "C", "D"];

export function validateReviewer(reviewer) {
  const errors = [];

  if (!reviewer?.reviewerId) errors.push("Missing reviewerId.");
  if (!reviewer?.title) errors.push("Missing title.");
  if (!reviewer?.subject) errors.push("Missing subject.");
  if (!Array.isArray(reviewer?.questions)) errors.push("Questions must be an array.");
  if (Array.isArray(reviewer?.questions) && reviewer.questionCount !== reviewer.questions.length) {
    errors.push("questionCount must match the number of questions.");
  }

  reviewer?.questions?.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    ["id", "topic", "question", "choices", "correctAnswer", "explanation"].forEach((field) => {
      if (question[field] === undefined || question[field] === "") {
        errors.push(`${label} is missing ${field}.`);
      }
    });

    const choiceKeys = Object.keys(question.choices || {});
    if (choiceKeys.length !== 4 || !REQUIRED_CHOICE_KEYS.every((key) => choiceKeys.includes(key))) {
      errors.push(`${label} must contain choices A, B, C, and D.`);
    }

    if (question.correctAnswer && !REQUIRED_CHOICE_KEYS.includes(question.correctAnswer)) {
      errors.push(`${label} has an invalid correctAnswer.`);
    }

    if (question.answerText !== undefined && question.choices?.[question.correctAnswer] !== question.answerText) {
      errors.push(`${label} answerText must match choices[correctAnswer].`);
    }
  });

  return { isValid: errors.length === 0, errors };
}

export const reviewers = [technoPrelim, technoPrelimReviewerFromMaam].map((reviewer) => ({
  ...reviewer,
  source: "built-in",
  validation: validateReviewer(reviewer)
}));

function withValidation(reviewer, source) {
  return {
    ...reviewer,
    source,
    validation: validateReviewer(reviewer)
  };
}

export function getAllReviewers() {
  const cloudReviewers = getCloudReviewerCache().map((reviewer) => withValidation(reviewer, "cloud"));
  const localReviewers = getLocalReviewers().map((reviewer) => withValidation(reviewer, "local"));
  const mergedReviewers = new Map();

  [...reviewers, ...cloudReviewers, ...localReviewers].forEach((reviewer) => {
    mergedReviewers.set(reviewer.reviewerId, reviewer);
  });

  return [...mergedReviewers.values()];
}

export function getReviewerById(reviewerId) {
  return getAllReviewers().find((reviewer) => reviewer.reviewerId === reviewerId);
}
