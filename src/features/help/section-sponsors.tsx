import {
  Callout,
  GuideSection,
  P,
  ScreenshotSlot,
  Step,
  Steps,
} from "./guide-ui";

export function SectionSponsors() {
  return (
    <GuideSection id="sponsors" kicker="Sponsorship" title="Sponsors">
      <P>
        The <strong>Sponsors</strong> screen keeps each sponsor&rsquo;s details
        in one place — name, logo, website link, and an optional &ldquo;active
        until&rdquo; date — so every issue can reuse them instead of you
        re-typing anything.
      </P>
      <Steps>
        <Step n={1} title="Add the sponsor once">
          Give it a name (that&rsquo;s the only must), upload their logo, add
          the website their card should link to, and — if the arrangement has an
          end date — set &ldquo;active until&rdquo;. When that date passes, the
          list marks the sponsor as expired so renewals don&rsquo;t slip by;
          nothing disappears from any issue on its own.
        </Step>
        <Step n={2} title="Put them in an issue">
          In the editor, insert a <strong>Sponsor</strong> block on a page and
          pick the sponsor from the list. The block shows their logo and links
          to their site.
        </Step>
        <Step n={3} title="Update in one place">
          Because the block points at the sponsor&rsquo;s record, changing the
          logo or link on the Sponsors screen updates every issue that features
          them — including ones already published.
        </Step>
      </Steps>
      <Callout title="Deleting a sponsor is the strong move">
        If you delete a sponsor, their card quietly vanishes from every issue
        that used it — a removed sponsor shouldn&rsquo;t keep advertising. If
        you only want to stop featuring them in <em>future</em> issues, keep the
        record and simply stop picking them.
      </Callout>
      <ScreenshotSlot description="The Sponsors screen: the list of sponsors with logos, links and their active-until dates." />
    </GuideSection>
  );
}
