import { Bullets, Callout, GuideSection, P, ScreenshotSlot } from "./guide-ui";

export function SectionMembers() {
  return (
    <GuideSection id="members" kicker="People" title="Members">
      <P>
        The <strong>Members</strong> screen is the guest list:{" "}
        <strong>only people on it can sign in.</strong> Keeping it current is
        all the &ldquo;security&rdquo; you ever need to do.
      </P>
      <Bullets>
        <li>
          <strong>Add one person</strong> with their email address (a name is
          optional but nice). They can sign in straight away — there&rsquo;s
          nothing to send them; they just use the sign-in page.
        </li>
        <li>
          <strong>Add many at once</strong> with the CSV import — a spreadsheet
          saved as CSV with an <strong>email</strong> column and an optional{" "}
          <strong>name</strong> column. You see exactly what will be added
          before you confirm; rows that aren&rsquo;t valid addresses and people
          already on the list are skipped, never duplicated.
        </li>
        <li>
          <strong>Subscribed</strong> controls one thing: whether that member
          gets the new-issue email when you publish. Turning it off
          doesn&rsquo;t remove them — they can still sign in and read. It flips
          off by itself when someone uses the unsubscribe link in an email.
        </li>
        <li>
          <strong>Admin</strong> gives someone full access to this Admin area —
          writing, publishing, and managing members. Hand it out sparingly, to
          people who are helping you run the magazine.
        </li>
        <li>
          <strong>Removing someone</strong> takes them off the list — they can
          no longer sign in.
        </li>
      </Bullets>
      <Callout title="Two guard rails, so you can’t lock yourself out">
        The site won&rsquo;t let you remove <em>yourself</em>, and it insists
        there is always at least one admin — the last admin can&rsquo;t be
        removed or demoted. So however much tidying you do, someone can always
        get back in to run things.
      </Callout>
      <ScreenshotSlot description="The Members screen: the list of members with their Subscribed and Admin toggles, and the Add and Import buttons." />
    </GuideSection>
  );
}
