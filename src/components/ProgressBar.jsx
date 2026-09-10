export default function ProgressBar({ value, max, label }) {
  const percentage = max ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="progress-wrap" aria-label={label}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
