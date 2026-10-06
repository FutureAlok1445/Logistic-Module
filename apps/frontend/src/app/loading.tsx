export default function Loading() {
  return (
    <main
      className="route-loading"
      role="status"
      aria-label="Loading workspace"
    >
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-surface" />
      <p>Preparing your workspace…</p>
    </main>
  );
}
