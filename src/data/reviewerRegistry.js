import technoPrelim from "./reviewers/bm2506_technopreneurship_prelim_reviewer.json";
import technoPrelimReviewerFromMaam from "./reviewers/technopreneurship_quiz_50_questions_verified.json";
import piit from "./reviewers/it2222_information_systems_technology_prelim_reviewer_balanced.json";

const REQUIRED_CHOICE_KEYS = ["A", "B", "C", "D"];

export function validateReviewer(reviewer) {
  const errors = [];

  if (!reviewer?.reviewerId) errors.push("Missing reviewerId.");
  if (!reviewer?.title) errors.push("Missing title.");
  if (!reviewer?.subject) errors.push("Missing subject.");
  if (!Array.isArray(reviewer?.questions)) errors.push("Questions must be an array.");

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
  });

  return { isValid: errors.length === 0, errors };
}

export const reviewers = [technoPrelim, technoPrelimReviewerFromMaam, piit].map((reviewer) => ({
  ...reviewer,
  validation: validateReviewer(reviewer)
}));

export function getReviewerById(reviewerId) {
  return reviewers.find((reviewer) => reviewer.reviewerId === reviewerId);
}
