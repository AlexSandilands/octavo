import { MembersFigure } from "./members-figure";
import { Callout, GuideSection, P, Step, Steps } from "./guide-ui";

export function SectionMembers() {
  return (
    <GuideSection id="members" kicker="People" title="Members">
      <P>
        The <strong>Members</strong> screen is the guest list:{" "}
        <strong>only people on it can sign in.</strong> Keeping it current is
        all the &ldquo;security&rdquo; you ever need to do.
      </P>
      <MembersFigure />
      <Steps>
        <Step n={1} title="Add one person">
          All you need is their email address (a name is optional but nice).
          They can sign in straight away — there&rsquo;s nothing to send them;
          they just use the sign-in page.
        </Step>
        <Step n={2} title="Add many at once">
          The CSV import takes a spreadsheet saved as CSV with an{" "}
          <strong>email</strong> column and an optional <strong>name</strong>{" "}
          column. You see exactly what will be added before you confirm; rows
          that aren&rsquo;t valid addresses and people already on the list are
          skipped, never duplicated.
        </Step>
        <Step n={3} title="Subscribed — the announcements switch">
          Click the pill to flip it. It controls one thing: whether that member
          gets the new-issue email when you publish. Turning it off
          doesn&rsquo;t remove them — they can still sign in and read. It flips
          off by itself when someone uses the unsubscribe link in an email.
        </Step>
        <Step n={4} title="Admin — the keys to this area">
          Admins get full access to everything you&rsquo;re using now — writing,
          publishing, members, sponsors. Hand it out sparingly, to people
          helping you run the magazine. Taking admin away asks you to confirm
          first.
        </Step>
        <Step n={5} title="Remove a member">
          The &times; at the end of the row takes them off the list — it asks
          you to confirm, then their access ends and they&rsquo;re signed out
          everywhere. It can&rsquo;t be undone (though you can always add them
          back fresh).
        </Step>
      </Steps>
      <Callout title="Two guard rails, so you can’t lock yourself out">
        The site won&rsquo;t let you remove <em>yourself</em>, and it insists
        there is always at least one admin — the last admin can&rsquo;t be
        removed or demoted. So however much tidying you do, someone can always
        get back in to run things.
      </Callout>
    </GuideSection>
  );
}
