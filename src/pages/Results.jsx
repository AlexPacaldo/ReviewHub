import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import ResultsSummary from "../components/ResultsSummary.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { getReviewerById } from "../data/reviewerRegistry.js";
import { createQuizSession } from "../utils/quizUtils.js";
import { getAttemptById, getLatestAttempt, saveQuizProgress } from "../utils/storageUtils.js";

export default function Results() {
  const { reviewerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const attemptId = new URLSearchParams(location.search).get("attempt");
  const attempt = attemptId ? getAttemptById(attemptId) : getLatestAttempt(reviewerId);
  const reviewer = getReviewerById(reviewerId);

  if (!attempt) {
    return <EmptyState title="No results found" message="Complete a quiz to see results here." action={<Link className="button primary" to={`/reviewer/${reviewerId}`}>Start Reviewer</Link>} />;
  }

  function retryIncorrect() {
    if (!reviewer || !attempt.incorrectQuestionIds.length) return;
    const session = createQuizSession(
      reviewer,
      {
        questionCount: attempt.incorrectQuestionIds.length,
        questionOrder: "original",
        choiceOrder: attempt.settings.choiceOrder || "original",
        mode: attempt.settings.mode || "practice"
      },
      attempt.incorrectQuestionIds
    );
    saveQuizProgress(session);
    navigate(`/quiz/${reviewerId}`);
  }

  return (
    <div className="page narrow">
      <ResultsSummary attempt={attempt} />
      <div className="button-grid">
        <Link className="button primary" to={`/review/${reviewerId}?attempt=${attempt.attemptId}`}>Review Answers</Link>
        {attempt.incorrectQuestionIds.length ? (
          <button className="button subtle" type="button" onClick={retryIncorrect}>Retry Incorrect Questions</button>
        ) : null}
        <Link className="button subtle" to={`/reviewer/${reviewerId}`}>Retake Quiz</Link>
        <Link className="button subtle" to="/">Back to Reviewers</Link>
      </div>
    </div>
  );
}
