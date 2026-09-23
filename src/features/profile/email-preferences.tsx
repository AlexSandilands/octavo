import { Button, Pill } from "@/components/ui";
import {
  updateEmailPreferenceAction,
  updateReplyEmailsAction,
} from "@/app/profile/actions";

// Both email settings, each one native form and one button (#86): the hidden
// value is the opposite of the current state and the button says exactly what
// pressing it does. The action takes *who* from the session, never the form.
// The state line is a live region, so the change is announced after a save.
function EmailToggle({
  id,
  label,
  description,
  on,
  field,
  action,
}: {
  id: string;
  label: string;
  description: React.ReactNode;
  on: boolean;
  field: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="border-line-soft border-t pt-5 first:border-t-0 first:pt-0">
      <h3 id={id} className="text-ink font-sans text-[16px] font-semibold">
        {label}
      </h3>
      <p className="text-muted mt-1.5 font-sans text-[15px] leading-relaxed">
        {description}
      </p>
      <div
        className="mt-3 flex items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <span className="text-muted font-sans text-sm">Currently:</span>
        <Pill status={on ? "Subscribed" : "Unsubscribed"} />
      </div>
      <form className="mt-4" action={action} aria-labelledby={id}>
        <input type="hidden" name={field} value={on ? "false" : "true"} />
        {on ? (
          <Button type="submit" variant="secondary" full>
            Turn these emails off
          </Button>
        ) : (
          <Button type="submit" full>
            Turn these emails on
          </Button>
        )}
      </form>
    </div>
  );
}

export function EmailPreferences({
  email,
  magazineName,
  subscribed,
  replyEmails,
  showReplyEmails,
}: {
  email: string;
  magazineName: string;
  subscribed: boolean;
  replyEmails: boolean;
  showReplyEmails: boolean;
}) {
  return (
    <section
      id="email"
      aria-labelledby="email-heading"
      className="border-line mt-10 scroll-mt-6 border-t pt-8"
    >
      <h2 id="email-heading" className="text-ink font-serif text-2xl">
        Email
      </h2>
      <p className="text-muted mt-2 font-sans text-[15px] leading-relaxed">
        We write to <span className="text-ink font-semibold">{email}</span>.
      </p>
      <div className="mt-6 space-y-6">
        <EmailToggle
          id="email-issues"
          label="New issues"
          description={`Email me when a new issue of ${magazineName} is published.`}
          on={subscribed}
          field="subscribe"
          action={updateEmailPreferenceAction}
        />
        {showReplyEmails && (
          <EmailToggle
            id="email-replies"
            label="Replies"
            description="Email me when someone replies to my comment."
            on={replyEmails}
            field="replyEmails"
            action={updateReplyEmailsAction}
          />
        )}
      </div>
    </section>
  );
}
