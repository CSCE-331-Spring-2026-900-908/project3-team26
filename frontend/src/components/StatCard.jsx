// StatCard: small reusable metric tile (label on top, big value below). Used on SalesPage
// for total sales, total orders, average order, and peak day. The optional tone prop
// changes the accent color via CSS class.
// The component intentionally has no formatting logic; callers pass already-formatted values.
export default function StatCard({ label, value, tone = 'default' }) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}
