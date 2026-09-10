import AnswerChoice from "./AnswerChoice.jsx";

export default function QuizQuestion({ question, selectedAnswer, revealed, locked, onSelect }) {
  return (
    <section className="question-panel">
      <div className="question-prompt">
        <p className="topic-label">{question.topic}</p>
        <h1>{question.question}</h1>
      </div>

      <div className="answers-grid">
        {question.choices.map((choice) => (
          <AnswerChoice
            key={choice.value}
            choice={choice}
            selected={selectedAnswer === choice.value}
            revealed={revealed}
            correct={question.correctAnswer === choice.value}
            disabled={locked}
            onSelect={() => onSelect(choice.value)}
          />
        ))}
      </div>
    </section>
  );
}
