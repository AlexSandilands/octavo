import { z } from "zod";
import { Button, Label, Wordmark } from "@/components/ui";
import { site } from "@/lib/site";
import { getRecipientById } from "@/server/recipients";
import { verifyUnsubscribeToken } from "@/server/unsubscribe-token";
import { updateSubscriptionAction } from "./actions";

// One-click unsubscribe, reached from a link in the new-issue email. No session
// required — the signed token in ?token= is the authorisation (see
// server/unsubscribe-token.ts). This route is intentionally NOT behind any
// member gate: the edge middleware's matcher covers only /, /read and /admin,
// so /unsubscribe stays reachable for a signed-out reader — keep it that way.
//
// GET is safe: it only reads and renders a confirm button. The actual flag
// change happens through a POSTed form, so an email scanner prefetching the
// link never mutates anything.
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ token: z.string().optional() });

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-card border-line w-full max-w-md rounded-2xl border p-8 shadow-[0_14px_34px_rgba(0,0,0,0.08)] sm:p-10">
        <Wordmark size={22} />
        <Label>{site.org}</Label>
        {children}
      </div>
    </main>
  );
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await searchParams);
  const token = parsed.success ? parsed.data.token : undefined;
  const userId = token ? verifyUnsubscribeToken(token) : null;
  const member = userId ? await getRecipientById(userId) : null;

  // Neutral message for anything invalid: no token, a tampered/forged token, or
  // a token whose user no longer exists. Says nothing that could confirm or
  // deny an address.
  if (!token || !member) {
    return (
      <Frame>
        <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
          This link isn&rsquo;t valid.
        </h1>
        <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
          The unsubscribe link may be incomplete or out of date. Use the
          Unsubscribe link at the bottom of a recent {site.name} email.
        </p>
      </Frame>
    );
  }

  if (member.subscribed) {
    return (
      <Frame>
        <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
          Unsubscribe from {site.name}?
        </h1>
        <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
          We&rsquo;ll stop emailing new issues to{" "}
          <span className="text-ink font-semibold">{member.email}</span>. You can
          resubscribe here any time.
        </p>
        <form className="mt-8" action={updateSubscriptionAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="subscribe" value="false" />
          <Button type="submit" full>
            Unsubscribe
          </Button>
        </form>
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
        You&rsquo;ve been unsubscribed.
      </h1>
      <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
        We won&rsquo;t email new issues to{" "}
        <span className="text-ink font-semibold">{member.email}</span> any more.
        Changed your mind? You can turn them back on.
      </p>
      <form className="mt-8" action={updateSubscriptionAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="subscribe" value="true" />
        <Button type="submit" variant="secondary" full>
          Resubscribe
        </Button>
      </form>
    </Frame>
  );
}
