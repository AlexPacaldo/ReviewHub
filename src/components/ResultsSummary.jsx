import { getPerformanceMessage, formatDuration } from "../utils/quizUtils.js";

export default function ResultsSummary({ attempt }) {
  return (
    <section className="results-summary">
      <p className="eyebrow">Quiz Complete</p>
      <h1>{attempt.score} / {attempt.totalQuestions}</h1>
      <p className="score-percent">{attempt.percentage}%</p>
      <p className="performance-message">{getPerformanceMessage(attempt.percentage)}</p>

      <div className="summary-grid">
        <div>
          <span>Correct Answers</span>
          <strong>{attempt.correctAnswers}</strong>
        </div>
        <div>
          <span>Wrong Answers</span>
          <strong>{attempt.wrongAnswers}</strong>
        </div>
        <div>
          <span>Total Questions</span>
          <strong>{attempt.totalQuestions}</strong>
        </div>
        <div>
          <span>Time Taken</span>
          <strong>{formatDuration(attempt.timeTaken)}</strong>
        </div>
      </div>
    </section>
  );
}
