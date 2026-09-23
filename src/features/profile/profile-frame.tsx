import Link from "next/link";
import { Label, Wordmark } from "@/components/ui";
import { getSettings } from "@/server/settings";

// The card the member's own pages sit in (lifted from /preferences, #86): the
// wordmark, the club, the content, and a way back to the library.
export async function ProfileFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-5">
      <div className="bg-card border-line w-full max-w-xl rounded-2xl border p-6 shadow-[0_14px_34px_rgba(0,0,0,0.08)] sm:p-10">
        <Wordmark size={22} />
        <Label>{org}</Label>
        {children}
        <div className="border-line mt-8 border-t pt-6">
          <Link
            href="/"
            className="text-muted hover:text-accent flex h-11 items-center font-sans text-sm font-medium hover:underline"
          >
            &larr; Back to the library
          </Link>
        </div>
      </div>
    </main>
  );
}
