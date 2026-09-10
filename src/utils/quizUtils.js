export function shuffleItems(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

export function normalizeChoices(choices) {
  return Object.entries(choices).map(([value, label]) => ({ value, label }));
}

export function buildSessionQuestions(questions, settings, retryQuestionIds = null) {
  let pool = retryQuestionIds?.length
    ? questions.filter((question) => retryQuestionIds.includes(question.id))
    : [...questions];

  if (settings.questionOrder === "random") pool = shuffleItems(pool);
  pool = pool.slice(0, settings.questionCount);

  return pool.map((question) => ({
    id: question.id,
    topic: question.topic,
    question: question.question,
    correctAnswer: question.correctAnswer,
    answerText: question.answerText || question.choices?.[question.correctAnswer],
    explanation: question.explanation,
    choices:
      settings.choiceOrder === "shuffle"
        ? shuffleItems(normalizeChoices(question.choices))
        : normalizeChoices(question.choices)
  }));
}

export function createQuizSession(reviewer, settings, retryQuestionIds = null) {
  const questions = buildSessionQuestions(reviewer.questions, settings, retryQuestionIds);
  const now = Date.now();

  return {
    sessionId: crypto.randomUUID(),
    reviewerId: reviewer.reviewerId,
    reviewerTitle: reviewer.title,
    subject: reviewer.subject,
    settings: {
      ...settings,
      questionCount: questions.length,
      retryQuestionIds: retryQuestionIds || []
    },
    questions,
    answers: {},
    submittedQuestions: {},
    currentIndex: 0,
    startedAt: now,
    elapsedBeforePause: 0,
    updatedAt: now,
    completed: false
  };
}

export function calculateScore(session) {
  return session.questions.reduce((score, question) => {
    return score + (session.answers[question.id] === question.correctAnswer ? 1 : 0);
  }, 0);
}

export function calculatePercentage(score, total) {
  return total ? Math.round((score / total) * 100) : 0;
}

export function getIncorrectQuestions(session) {
  return session.questions.filter((question) => session.answers[question.id] !== question.correctAnswer);
}

export function getQuestionResult(question, selectedAnswer) {
  const selectedChoice = question.choices.find((choice) => choice.value === selectedAnswer);
  const correctChoice = question.choices.find((choice) => choice.value === question.correctAnswer);

  return {
    isCorrect: selectedAnswer === question.correctAnswer,
    selectedText: selectedChoice?.label || "No answer",
    correctText: correctChoice?.label || question.answerText
  };
}

export function formatDuration(milliseconds = 0) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const displayMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}:${String(displayMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${displayMinutes}:${String(seconds).padStart(2, "0")}`;
}

export function createAttemptFromSession(session) {
  const score = calculateScore(session);
  const totalQuestions = session.questions.length;
  const incorrectQuestions = getIncorrectQuestions(session);

  return {
    attemptId: crypto.randomUUID(),
    reviewerId: session.reviewerId,
    reviewerTitle: session.reviewerTitle,
    subject: session.subject,
    score,
    totalQuestions,
    percentage: calculatePercentage(score, totalQuestions),
    correctAnswers: score,
    wrongAnswers: incorrectQuestions.length,
    incorrectQuestionIds: incorrectQuestions.map((question) => question.id),
    timeTaken: (session.elapsedBeforePause || 0) + (Date.now() - session.startedAt),
    date: new Date().toISOString(),
    settings: session.settings,
    questions: session.questions,
    answers: session.answers
  };
}

export function getPerformanceMessage(percentage) {
  if (percentage >= 90) return "Excellent! You really know this topic.";
  if (percentage >= 80) return "Great job! You're almost there.";
  if (percentage >= 70) return "Good work. Review a few more topics.";
  return "Keep reviewing. You can improve this.";
}
