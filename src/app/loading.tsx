import { Wordmark } from "@/components/ui";

export default function LibraryLoading() {
  return (
    <main
      className="mx-auto max-w-[1280px] px-5 py-5 sm:px-10"
      aria-busy="true"
      aria-label="Loading the reading room"
    >
      <header className="border-ink border-b pb-4">
        <Wordmark size={26} />
      </header>
      <div className="border-ink flex h-60 items-center justify-center border-b-4 border-double">
        <div className="bg-line h-24 w-80 animate-pulse motion-reduce:animate-none" />
      </div>
      <div
        className="grid gap-10 py-10 md:grid-cols-[1fr_260px_1fr]"
        aria-hidden="true"
      >
        <div>
          <div className="bg-line h-4 w-36 animate-pulse motion-reduce:animate-none" />
          <div className="bg-line mt-6 h-32 w-full animate-pulse motion-reduce:animate-none" />
          <div className="bg-line mt-10 h-12 w-44 animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="bg-line mx-auto h-[366px] w-[260px] animate-pulse motion-reduce:animate-none" />
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-line h-14 animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading the reading room…
      </span>
    </main>
  );
}
