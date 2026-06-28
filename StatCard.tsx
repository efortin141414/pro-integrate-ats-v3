export function StatCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <div className="stat-card">
      <p className="muted small">{title}</p>
      <h2>{value}</h2>
      {subtitle && <p className="muted small">{subtitle}</p>}
    </div>
  );
}
