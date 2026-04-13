interface StatCardProps {
  eyebrow: string;
  value: string;
  hint: string;
  tone?: "default" | "accent";
}

export function StatCard({ eyebrow, value, hint, tone = "default" }: StatCardProps) {
  return (
    <article className={`stat-card ${tone === "accent" ? "stat-card-accent" : ""}`}>
      <p className="stat-eyebrow">{eyebrow}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-hint">{hint}</p>
    </article>
  );
}
