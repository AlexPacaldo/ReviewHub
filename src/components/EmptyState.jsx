export default function EmptyState({ title, message, action }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}
