export default function LoadingReports() {
  return (
    <div className="mx-auto max-w-350 px-5 py-8" role="status">
      <h1 className="page-title">Reports</h1>
      <p className="mt-4 text-secondary">Loading your financial data…</p>
      <div className="mt-6 h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
