import { z } from "zod";
import { Button, Label, Wordmark } from "@/components/ui";
import { getSettings } from "@/server/settings";
import { getRecipientById } from "@/server/recipients";
import {
  verifyUnsubscribeToken,
  type UnsubscribePurpose,
} from "@/server/unsubscribe-token";
import { updateSubscriptionAction } from "./actions";

// One-click unsubscribe, reached from a link in the new-issue email — or, for a
// token whose purpose is `replies`, the reply email (issue #303). No session
// required — the signed token in ?token= is the authorisation (see
// server/unsubscribe-token.ts). This route is intentionally NOT behind any
// member gate: the proxy's matcher covers only /, /read and /admin,
// so /unsubscribe stays reachable for a signed-out reader — keep it that way.
//
// GET is safe: it only reads and renders a confirm button. The actual flag
// change happens through a POSTed form, so an email scanner prefetching the
// link never mutates anything.
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ token: z.string().optional() });

async function Frame({ children }: { children: React.ReactNode }) {
  const { org } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-card border-line w-full max-w-md rounded-2xl border p-8 shadow-[0_14px_34px_rgba(0,0,0,0.08)] sm:p-10">
        <Wordmark size={22} />
        <Label>{org}</Label>
        {children}
      </div>
    </main>
  );
}

// What the page says for each purpose (issue #303), with the emails on and off.
// The issues wording is the page as it read before reply emails existed.
function copyFor(purpose: UnsubscribePurpose, magazineName: string) {
  return purpose === "replies"
    ? {
        onTitle: "Stop reply emails?",
        onLead: "We’ll stop emailing",
        onTail:
          " when someone replies to your comments. New-issue emails aren’t affected, and the bell in the library still shows new replies.",
        confirm: "Stop reply emails",
        offTitle: "Reply emails are off.",
        offLead: "We won’t email",
        offTail:
          " about replies to your comments any more. Changed your mind? You can turn them back on.",
        restore: "Turn reply emails back on",
      }
    : {
        onTitle: `Unsubscribe from ${magazineName}?`,
        onLead: "We’ll stop emailing new issues to",
        onTail: ". You can resubscribe here any time.",
        confirm: "Unsubscribe",
        offTitle: "You’ve been unsubscribed.",
        offLead: "We won’t email new issues to",
        offTail: " any more. Changed your mind? You can turn them back on.",
        restore: "Resubscribe",
      };
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await searchParams);
  const { name: magazineName } = await getSettings();
  const token = parsed.success ? parsed.data.token : undefined;
  const grant = token ? verifyUnsubscribeToken(token) : null;
  const member = grant ? await getRecipientById(grant.userId) : null;

  // Neutral message for anything invalid: no token, a tampered/forged token, or
  // a token whose user no longer exists. Says nothing that could confirm or
  // deny an address.
  if (!token || !grant || !member) {
    return (
      <Frame>
        <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
          This link isn&rsquo;t valid.
        </h1>
        <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
          The unsubscribe link may be incomplete or out of date. Use the
          Unsubscribe link at the bottom of a recent {magazineName} email.
        </p>
      </Frame>
    );
  }

  const copy = copyFor(grant.purpose, magazineName);
  const on =
    grant.purpose === "replies" ? member.replyEmails : member.subscribed;
  return (
    <Frame>
      <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
        {on ? copy.onTitle : copy.offTitle}
      </h1>
      <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
        {on ? copy.onLead : copy.offLead}{" "}
        <span className="text-ink font-semibold">{member.email}</span>
        {on ? copy.onTail : copy.offTail}
      </p>
      <form className="mt-8" action={updateSubscriptionAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="subscribe" value={on ? "false" : "true"} />
        <Button type="submit" variant={on ? "primary" : "secondary"} full>
          {on ? copy.confirm : copy.restore}
        </Button>
      </form>
    </Frame>
  );
}
