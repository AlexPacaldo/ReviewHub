import { Link } from "react-router-dom";
import { ArrowRight, Layers } from "lucide-react";

export default function ReviewerCard({ reviewer, progress }) {
  const code = reviewer.title.split(" ")[0];

  return (
    <article className="reviewer-card">
      <div className="card-topline">
        <span className="course-code">{code}</span>
        <span className="question-count">{reviewer.questions?.length || reviewer.questionCount} Questions</span>
      </div>

      <h3>{reviewer.subject}</h3>
      <p className="muted">{reviewer.title}</p>

      <div className="coverage-block">
        <div className="coverage-title">
          <Layers size={16} aria-hidden="true" />
          Coverage
        </div>
        <ul>
          {reviewer.coverage?.slice(0, 4).map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </div>

      {progress ? <p className="resume-note">Unfinished quiz saved</p> : null}

      <Link className="button primary wide" to={`/reviewer/${reviewer.reviewerId}`}>
        Start Reviewer
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </article>
  );
}
