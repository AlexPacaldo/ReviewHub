import { Link } from "react-router-dom";
import { ArrowRight, Layers, Trash2 } from "lucide-react";

export default function ReviewerCard({ reviewer, progress, onDelete }) {
  const code = reviewer.title.split(" ")[0];
  const statusLabels = {
    cloud: "Cloud only",
    local: "Offline only",
    both: "Cloud + offline"
  };
  const statusClass = reviewer.storageStatus || reviewer.source;
  const statusLabel = statusLabels[statusClass];

  return (
    <article className="reviewer-card">
      <div className="card-topline">
        <span className="course-code">{code}</span>
        <span className="question-count">{reviewer.questions?.length || reviewer.questionCount} Questions</span>
      </div>
      {statusLabel ? <span className={`reviewer-source-badge ${statusClass}`}>{statusLabel}</span> : null}

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

      <div className="reviewer-actions">
        <Link className="button primary wide" to={`/reviewer/${reviewer.reviewerId}`}>
          Start Reviewer
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        {reviewer.source === "local" && onDelete ? (
          <button className="button subtle icon-danger" type="button" onClick={() => onDelete(reviewer)}>
            <Trash2 size={17} aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>
    </article>
  );
}
