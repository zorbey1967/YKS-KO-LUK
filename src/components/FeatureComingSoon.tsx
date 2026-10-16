export function FeatureComingSoon({ title }: { title: string }) {
  return (
    <div className="card notice">
      <h3>{title}</h3>
      <p className="muted">Bu özellik şu anda geliştirme aşamasında.</p>
    </div>
  );
}
