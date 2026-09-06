import { Wordmark, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-card border-line flex min-h-[420px] w-full max-w-xl flex-col rounded-[24px] border p-8 shadow-sm sm:p-10">
        <Wordmark size={24} />
        <div className="my-10">
          <p className="text-accent text-sm font-semibold">
            404 · Page not found
          </p>
          <h1 className="text-ink mt-3 text-4xl font-semibold leading-[1.1]">
            Let’s get you back
            <br />
            to the library.
          </h1>
          <p className="text-muted mt-4 text-base leading-relaxed">
            This page may have moved, or the address may be incomplete. Your
            club’s published issues are in the library.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button href="/" icon="arrowRight">
            Go to library
          </Button>
          <Button href="/signin" variant="secondary">
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
