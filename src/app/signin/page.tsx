import { z } from "zod";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { FIELD_CLASS } from "@/components/dialog-parts";
import { getSettings } from "@/server/settings";
import { SignInCard } from "./card";
import { safeNextPath } from "@/lib/next-path";
import { requestMagicLink } from "./actions";

// Sign-in — enter your email, get a magic link. Also serves as Auth.js's
// error page (?error=...): the common case is Verification, an expired or
// already-used link, which becomes an invitation to request a fresh one.
const ERROR_COPY: Record<string, { title: string; body: string }> = {
  Verification: {
    title: "That link has expired.",
    body: "Sign-in links only work once and expire after a day. Enter your email and we'll send you a fresh one.",
  },
  "invalid-email": {
    title: "That doesn't look like an email address.",
    body: "Check for typos and try again.",
  },
  "rate-limited": {
    title: "Too many attempts.",
    body: "For your security we've paused sign-in links for a few minutes. Please wait, then request a fresh one.",
  },
};

const GENERIC_ERROR = {
  title: "Something went wrong.",
  body: "We couldn't sign you in just now. Enter your email and we'll send you a new link.",
};

// ?error= and ?next= are external input (Next may even hand back string[]
// for a duplicated key) — validate at the boundary like everything else.
const paramsSchema = z.object({
  error: z.string().optional(),
  next: z.string().optional(),
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await searchParams);
  const error = parsed.success ? parsed.data.error : "unknown";
  const next = safeNextPath(parsed.success ? parsed.data.next : undefined);
  const notice = error ? (ERROR_COPY[error] ?? GENERIC_ERROR) : null;
  const { name } = await getSettings();

  return (
    <SignInCard>
      <h1 className="text-fg mt-8 font-ui text-[32px] leading-[1.1] font-bold">
        Welcome back
      </h1>
      {notice ? (
        <div
          role="alert"
          className="bg-warn-soft border-l-warn mt-5 flex gap-3 rounded-field border-l-[5px] p-4"
        >
          <Icon
            name="alertCircle"
            size={22}
            strokeWidth={2}
            className="text-warn mt-0.5 flex-none"
          />
          <div>
            <p className="text-fg font-ui text-[17px] font-bold">
              {notice.title}
            </p>
            <p className="text-fg-muted mt-1 font-ui text-[16px] leading-relaxed">
              {notice.body}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-fg-muted mt-3 font-ui text-[17px] leading-relaxed">
          Members read {name} with a private link. Enter your email and
          we&apos;ll send one over.
        </p>
      )}

      <form className="mt-7" action={requestMagicLink}>
        {/* Carries the destination (validated same-origin) into the emailed
            link, so the member lands where they were headed. */}
        <input type="hidden" name="next" value={next} />
        <label
          htmlFor="email"
          className="text-fg-muted mb-2 block font-ui text-[14px] font-bold tracking-[0.06em] uppercase"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={`${FIELD_CLASS} h-14`}
        />
        <div className="mt-4">
          <Button type="submit" icon="mail" size="lg" full>
            Email me a link
          </Button>
        </div>
        <p className="text-fg-muted mt-4 text-center font-ui text-[15px]">
          No password to remember.
        </p>
      </form>
    </SignInCard>
  );
}
