export default function QuestionNavigator({ open, questions, currentIndex, answers, submittedQuestions, onJump, onClose }) {
  if (!open) return null;

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="question-drawer" role="dialog" aria-modal="true" aria-label="Question navigator" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>Questions</h2>
          <button className="button subtle" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="question-grid">
          {questions.map((question, index) => {
            const isCurrent = index === currentIndex;
            const isAnswered = Boolean(answers[question.id]);
            const isSubmitted = Boolean(submittedQuestions?.[question.id]);
            return (
              <button
                key={question.id}
                type="button"
                className={`question-dot${isCurrent ? " current" : ""}${isAnswered ? " answered" : ""}${isSubmitted ? " submitted" : ""}`}
                onClick={() => {
                  onJump(index);
                  onClose();
                }}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
