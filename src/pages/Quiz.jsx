import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Grid3X3 } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import QuizQuestion from "../components/QuizQuestion.jsx";
import QuestionNavigator from "../components/QuestionNavigator.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { getReviewerById } from "../data/reviewerRegistry.js";
import { clearQuizProgress, loadQuizProgress, saveAttempt, saveQuizProgress } from "../utils/storageUtils.js";
import { createAttemptFromSession, formatDuration, getQuestionResult } from "../utils/quizUtils.js";

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
}

export default function Quiz() {
  const { reviewerId } = useParams();
  const navigate = useNavigate();
  const reviewer = getReviewerById(reviewerId);
  const [session, setSession] = useState(() => loadQuizProgress(reviewerId));
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const currentQuestion = session?.questions[session.currentIndex];
  const mode = session?.settings.mode;
  const selectedAnswer = currentQuestion ? session.answers[currentQuestion.id] : null;
  const isPracticeSubmitted = currentQuestion ? Boolean(session.submittedQuestions[currentQuestion.id]) : false;
  const isPracticeRevealed = mode === "practice" && Boolean(selectedAnswer);
  const isLastQuestion = session ? session.currentIndex === session.questions.length - 1 : false;

  useEffect(() => {
    if (!session) return;
    saveQuizProgress({ ...session, updatedAt: Date.now() });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const tick = () => setElapsed((session.elapsedBeforePause || 0) + (Date.now() - session.startedAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session?.startedAt, session?.elapsedBeforePause]);

  useEffect(() => {
    if (!session || !currentQuestion) return;
    const handler = (event) => {
      if (isTypingTarget(event.target)) return;

      if (["1", "2", "3", "4"].includes(event.key)) {
        const choice = currentQuestion.choices[Number(event.key) - 1];
        if (choice && !(mode === "practice" && isPracticeRevealed)) {
          chooseAnswer(choice.value);
        }
      }

      if (event.key === "Enter") {
        if (mode === "practice") {
          if (isPracticeRevealed) goNextOrFinish();
        } else if (isLastQuestion) {
          setConfirmSubmit(true);
        } else if (selectedAnswer) {
          goNext();
        }
      }

      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "ArrowRight") {
        if (mode === "practice") {
          if (isPracticeRevealed && !isLastQuestion) goNext();
        } else {
          goNext();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const answeredCount = useMemo(() => (session ? Object.keys(session.answers).length : 0), [session]);

  if (!reviewer || !session) {
    return (
      <EmptyState
        title="No active quiz"
        message="Start or continue a reviewer quiz first."
        action={<Link className="button primary" to={reviewer ? `/reviewer/${reviewerId}` : "/"}>Back to Reviewer</Link>}
      />
    );
  }

  function patchSession(patch) {
    setSession((current) => ({ ...current, ...patch }));
  }

  function chooseAnswer(answer) {
    if (mode === "practice" && (isPracticeRevealed || isPracticeSubmitted)) return;
    if (mode === "exam") {
      patchSession({ answers: { ...session.answers, [currentQuestion.id]: answer } });
      return;
    }
    patchSession({
      answers: { ...session.answers, [currentQuestion.id]: answer },
      submittedQuestions: { ...session.submittedQuestions, [currentQuestion.id]: true }
    });
  }

  function goPrevious() {
    if (session.currentIndex > 0) patchSession({ currentIndex: session.currentIndex - 1 });
  }

  function goNext() {
    if (!isLastQuestion) patchSession({ currentIndex: session.currentIndex + 1 });
  }

  function completeQuiz() {
    const finalSession = { ...session, elapsedBeforePause: elapsed, completed: true };
    const attempt = createAttemptFromSession(finalSession);
    saveAttempt(attempt);
    clearQuizProgress(session.reviewerId);
    navigate(`/results/${session.reviewerId}?attempt=${attempt.attemptId}`);
  }

  function goNextOrFinish() {
    if (isLastQuestion) completeQuiz();
    else goNext();
  }

  const result = currentQuestion ? getQuestionResult(currentQuestion, selectedAnswer) : null;

  return (
    <div className="quiz-layout">
      <section className="quiz-topbar">
        <div>
          <p className="eyebrow">{session.subject}</p>
          <h1>Question {session.currentIndex + 1} of {session.questions.length}</h1>
        </div>
        <div className="quiz-meta">
          {mode === "exam" ? <span className="timer">{formatDuration(elapsed)}</span> : null}
          <button className="button subtle" type="button" onClick={() => setNavigatorOpen(true)}>
            <Grid3X3 size={17} aria-hidden="true" />
            Questions
          </button>
          <button className="button subtle" type="button" onClick={() => setConfirmLeave(true)}>
            Leave
          </button>
        </div>
      </section>

      <ProgressBar value={session.currentIndex + 1} max={session.questions.length} label="Quiz progress" />

      <QuizQuestion
        question={currentQuestion}
        selectedAnswer={selectedAnswer}
        revealed={isPracticeRevealed}
        locked={isPracticeRevealed}
        onSelect={chooseAnswer}
      />

      {isPracticeRevealed ? (
        <section className={`feedback-panel ${result.isCorrect ? "success" : "danger"}`}>
          <h2>{result.isCorrect ? "Correct!" : "Incorrect"}</h2>
          <p>Your answer: <strong>{result.selectedText}</strong></p>
          <p>Correct answer: <strong>{result.correctText}</strong></p>
          <p><strong>Explanation:</strong> {currentQuestion.explanation}</p>
        </section>
      ) : null}

      <section className="quiz-actions">
        <button className="button subtle" type="button" onClick={goPrevious} disabled={session.currentIndex === 0}>
          <ArrowLeft size={17} aria-hidden="true" />
          Previous
        </button>

        <span className="answered-count">{answeredCount} answered</span>

        {mode === "practice" ? (
          isPracticeRevealed ? (
            <button className="button primary" type="button" onClick={goNextOrFinish}>
              {isLastQuestion ? "Finish Quiz" : "Next Question"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : (
            <span className="answered-count">Select an answer to check it</span>
          )
        ) : isLastQuestion ? (
          <button className="button primary" type="button" onClick={() => setConfirmSubmit(true)}>
            Submit Quiz
          </button>
        ) : (
          <button className="button primary" type="button" onClick={goNext}>
            Next
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
      </section>

      <QuestionNavigator
        open={navigatorOpen}
        questions={session.questions}
        currentIndex={session.currentIndex}
        answers={session.answers}
        submittedQuestions={session.submittedQuestions}
        onJump={(index) => patchSession({ currentIndex: index })}
        onClose={() => setNavigatorOpen(false)}
      />

      <ConfirmModal
        open={confirmSubmit}
        title="Submit Quiz?"
        message="Are you sure you want to submit your quiz?"
        confirmLabel="Submit Quiz"
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={completeQuiz}
      />

      <ConfirmModal
        open={confirmLeave}
        title="Leave Quiz?"
        message="Your progress has been saved and you can continue later."
        cancelLabel="Stay"
        confirmLabel="Leave Quiz"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => navigate(`/reviewer/${session.reviewerId}`)}
      />
    </div>
  );
}
