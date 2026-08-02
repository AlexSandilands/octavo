import { Callout, GuideSection, P } from "./guide-ui";

export function SectionLogos() {
  return (
    <GuideSection id="logos" kicker="Club marks" title="Logos">
      <P>
        The <strong>Logos</strong> screen is a small library of the club&rsquo;s
        own marks — a crest, an emblem, a wordmark. Give each one a name, upload
        the picture once, and it&rsquo;s available to the rest of the magazine;
        rename it any time. It&rsquo;s separate from Sponsors, which is for
        other people&rsquo;s businesses.
      </P>
      <P>
        To put one on an issue, open that issue in the editor and choose it from
        the <strong>Logo</strong> box at the top. It then appears small at the
        foot of every page, with the club&rsquo;s name spread across the width
        beside it. Choose <strong>None</strong> to go back to the plain footer.
        A mark that an issue is using can&rsquo;t be deleted here until you
        change that issue&rsquo;s choice.
      </P>
      <Callout title="Use a see-through picture">
        Upload a <strong>PNG</strong> or <strong>WebP</strong> saved with a
        transparent background — the transparency is kept, so the mark sits on
        the page without a white box around it. A photo or a scan on white will
        show that white.
      </Callout>
    </GuideSection>
  );
}
