import { z } from "zod";
import { SheetPage } from "@/components/sheet-page";
import { Button } from "@/components/ui";
import { getSettings } from "@/server/settings";
import { getRecipientById } from "@/server/recipients";
import { verifyUnsubscribeToken } from "@/server/unsubscribe-token";
import { updateSubscriptionAction } from "./actions";

// One-click unsubscribe, reached from a link in the new-issue email. No session
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

const H1 = "text-ink font-display text-[32px] leading-[1.1]";
const P = "text-muted mt-4 font-ui text-[17px] leading-relaxed";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await searchParams);
  const { name: magazineName } = await getSettings();
  const token = parsed.success ? parsed.data.token : undefined;
  const userId = token ? verifyUnsubscribeToken(token) : null;
  const member = userId ? await getRecipientById(userId) : null;

  // Neutral message for anything invalid: no token, a tampered/forged token, or
  // a token whose user no longer exists. Says nothing that could confirm or
  // deny an address.
  if (!token || !member) {
    return (
      <SheetPage>
        <h1 className={H1}>This link isn&rsquo;t valid.</h1>
        <p className={P}>
          The unsubscribe link may be incomplete or out of date. Use the
          Unsubscribe link at the bottom of a recent {magazineName} email.
        </p>
      </SheetPage>
    );
  }

  if (member.subscribed) {
    return (
      <SheetPage>
        <h1 className={H1}>Unsubscribe from {magazineName}?</h1>
        <p className={P}>
          We&rsquo;ll stop emailing new issues to{" "}
          <span className="text-ink font-semibold">{member.email}</span>. You
          can resubscribe here any time.
        </p>
        <form className="mt-8" action={updateSubscriptionAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="subscribe" value="false" />
          <Button type="submit" full>
            Unsubscribe
          </Button>
        </form>
      </SheetPage>
    );
  }

  return (
    <SheetPage>
      <h1 className={H1}>You&rsquo;ve been unsubscribed.</h1>
      <p className={P}>
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
    </SheetPage>
  );
}
