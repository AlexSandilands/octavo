import { z } from "zod";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { getSettings } from "@/server/settings";
import { getRecipientById } from "@/server/recipients";
import { verifyUnsubscribeToken } from "@/server/unsubscribe-token";
import { SignInCard } from "@/app/signin/card";
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

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-fg mt-8 font-ui text-[30px] leading-[1.15] font-bold">
      {children}
    </h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-fg-muted mt-3 font-ui text-[17px] leading-relaxed">
      {children}
    </p>
  );
}

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
      <SignInCard>
        <Title>This link isn&rsquo;t valid.</Title>
        <Body>
          The unsubscribe link may be incomplete or out of date. Use the
          Unsubscribe link at the bottom of a recent {magazineName} email.
        </Body>
      </SignInCard>
    );
  }

  if (member.subscribed) {
    return (
      <SignInCard>
        <Title>Unsubscribe from {magazineName}?</Title>
        <Body>
          We&rsquo;ll stop emailing new issues to{" "}
          <span className="text-fg font-bold">{member.email}</span>. You can
          resubscribe here any time.
        </Body>
        <form className="mt-7" action={updateSubscriptionAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="subscribe" value="false" />
          <Button type="submit" size="lg" full>
            Unsubscribe
          </Button>
        </form>
      </SignInCard>
    );
  }

  return (
    <SignInCard>
      <div className="bg-ok-soft text-ok mt-8 flex h-14 w-14 items-center justify-center rounded-full">
        <Icon name="checkCircle" size={28} strokeWidth={1.9} />
      </div>
      <h1 className="text-fg mt-4 font-ui text-[30px] leading-[1.15] font-bold">
        You&rsquo;ve been unsubscribed.
      </h1>
      <Body>
        We won&rsquo;t email new issues to{" "}
        <span className="text-fg font-bold">{member.email}</span> any more.
        Changed your mind? You can turn them back on.
      </Body>
      <form className="mt-7" action={updateSubscriptionAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="subscribe" value="true" />
        <Button type="submit" variant="secondary" size="lg" full>
          Resubscribe
        </Button>
      </form>
    </SignInCard>
  );
}
