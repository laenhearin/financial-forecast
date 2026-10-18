/** Placeholder for pages that are not built yet; uses the Home content column. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-180 px-5 py-12 text-center md:px-10">
      <h1 className="text-display font-medium text-primary">{title}</h1>
      <p className="mt-2.5 text-body text-secondary">Coming soon.</p>
    </div>
  );
}
