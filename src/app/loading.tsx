export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-6xl animate-pulse px-5 py-16"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="h-8 w-56 rounded bg-secondary" />
      <div className="mt-6 h-32 rounded-2xl bg-secondary" />
    </main>
  );
}
