import { PublishFigure } from "./publish-figure";
import { Bullets, Callout, GuideSection, P, ScreenshotSlot } from "./guide-ui";

export function SectionPublishing() {
  return (
    <GuideSection
      id="publishing"
      kicker="The careful bit"
      title="Publish an issue"
    >
      <P>
        Publishing does two separate things, and it helps to keep them apart in
        your head: it <strong>puts the issue in the library</strong> so members
        can read it, and it can{" "}
        <strong>also email every subscribed member</strong> to tell them
        it&rsquo;s out.
      </P>
      <Callout
        tone="careful"
        icon="mail"
        title="Publishing can send real email to real people"
      >
        In the confirmation window, the{" "}
        <strong>&ldquo;Email the new issue&rdquo;</strong> tickbox decides
        whether the site emails <strong>every subscribed member</strong> a
        personal reading link. Once those emails go out they can&rsquo;t be
        called back — so before you confirm, glance at that tickbox and make
        sure it says what you intend. The window always tells you exactly how
        many people would be emailed.
      </Callout>
      <PublishFigure />
      <P>How the email tickbox behaves:</P>
      <Bullets>
        <li>
          <strong>Publishing an issue for the first time</strong>, the box
          starts ticked — a brand-new issue is usually worth announcing.
        </li>
        <li>
          <strong>Publishing the same issue again</strong> (say, after fixing a
          typo), the box starts unticked — so a small correction can&rsquo;t
          accidentally email the whole club twice. Tick it yourself if you
          really do want to re-send.
        </li>
        <li>
          <strong>Each email is personal.</strong> The message <em>is</em> that
          member&rsquo;s sign-in link: one click opens the new issue with no
          password. That also means one member&rsquo;s email shouldn&rsquo;t be
          forwarded to someone else — the link would sign them in as the
          original member.
        </li>
        <li>
          <strong>Every email carries an unsubscribe link.</strong> A member who
          uses it stops getting new-issue announcements but stays a member and
          can still sign in and read. You can re-subscribe them on the Members
          screen if they change their mind.
        </li>
        <li>
          <strong>Afterwards you get a plain answer</strong> — how many emails
          were sent, and whether any failed. If some failed, publish again with
          the box ticked to retry them.
        </li>
      </Bullets>
      <ScreenshotSlot description="The publish confirmation window, showing the “Email the new issue” tickbox and the number of members it would email." />
    </GuideSection>
  );
}
