import { Link } from "react-router-dom";
import { Layers, Trash2, Users } from "lucide-react";
import hachiDogCurious from "../assets/hachi-dog-curious.png";
import hachiDogExcited from "../assets/hachi-dog-excited.png";
import hachiDogFocused from "../assets/hachi-dog-focused.png";
import hachiDogProud from "../assets/hachi-dog-proud.png";

function getCardTone(reviewerId = "") {
  const tones = ["mint", "rose", "blue", "amber"];
  const total = [...reviewerId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[total % tones.length];
}

function getDogState({ progress, hasCompleted }) {
  if (progress) {
    return {
      label: "In progress",
      className: "in-progress",
      image: hachiDogFocused
    };
  }

  if (hasCompleted) {
    return {
      label: "Completed",
      className: "completed",
      image: hachiDogProud
    };
  }

  return {
    label: "Not started",
    className: "not-started",
    image: hachiDogCurious
  };
}

export default function ReviewerCard({ reviewer, progress, hasCompleted = false, onDelete }) {
  const code = reviewer.title.split(" ")[0];
  const statusLabels = {
    cloud: "Cloud only",
    local: "Offline only",
    both: "Cloud + offline"
  };
  const statusClass = reviewer.storageStatus || reviewer.source;
  const statusLabel = statusLabels[statusClass];
  const cardTone = getCardTone(reviewer.reviewerId);
  const dogState = getDogState({ progress, hasCompleted });

  return (
    <article className={`reviewer-card reviewer-card-${cardTone}`}>
      <Link className="reviewer-card-link" to={`/reviewer/${reviewer.reviewerId}`}>
        <div className="reviewer-card-hero">
          <div className="card-topline">
            <span className="course-code">{code}</span>
            <span className="question-count">{reviewer.questions?.length || reviewer.questionCount} Questions</span>
          </div>
          {statusLabel ? <span className={`reviewer-source-badge ${statusClass}`}>{statusLabel}</span> : null}

          {reviewer.ownerName ? (
            <span className="reviewer-owner-note" title={`Shared by ${reviewer.ownerName}`}>
              <Users size={13} aria-hidden="true" />
              Shared by {reviewer.ownerName}
            </span>
          ) : null}

          <h3>{reviewer.subject}</h3>
          <p>{reviewer.title}</p>
          <span className={`reviewer-progress-badge ${dogState.className}`}>{dogState.label}</span>
          <img className={`reviewer-card-dog ${dogState.className}`} src={dogState.image || hachiDogExcited} alt="" aria-hidden="true" />
        </div>

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
      </Link>

      {reviewer.source === "local" && onDelete ? (
        <button className="button subtle icon-danger reviewer-remove" type="button" onClick={() => onDelete(reviewer)}>
          <Trash2 size={17} aria-hidden="true" />
          Remove
        </button>
      ) : null}
    </article>
  );
}
