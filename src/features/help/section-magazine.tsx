import { Bullets, Callout, GuideSection, P } from "./guide-ui";

export function SectionMagazine() {
  return (
    <GuideSection
      id="magazine"
      kicker="Naming and marks"
      title="Magazine details"
    >
      <P>
        The <strong>Magazine</strong> screen is where the publication says what
        it is. Change any of it and the whole site follows straight away — the
        library, the reader, the sign-in screen, the emails and the PDFs. There
        is nothing to rebuild and nobody to ask.
      </P>
      <P>
        <strong>Details</strong> holds three pieces of wording:
      </P>
      <Bullets>
        <li>
          <strong>Magazine name</strong> — the masthead, and the title of every
          email that goes out.
        </li>
        <li>
          <strong>Club or organisation</strong> — who publishes it. This is the
          wording that sits beside your mark at the foot of every page.
        </li>
        <li>
          <strong>Tagline</strong> — the single line under the club name on the
          library page.
        </li>
      </Bullets>
      <P>
        Leave a box empty and the magazine falls back to the wording it was set
        up with when the site was installed; the note under the box tells you
        what that is. Clearing a field never leaves the magazine nameless.
      </P>
      <P>
        <strong>Page footer</strong> sets how the foot of a page looks: how big
        the mark is, how big the wording is, and whether the lockup sits on the
        left, in the middle or on the right (the page number always takes the
        opposite margin). The picture beside the settings updates as you choose,
        before you save — use the two boxes above it to look at either layout
        theme, and at each of your marks.
      </P>
      <Callout title="After you make the footer bigger">
        A bigger mark or bigger text makes the footer taller, and that leaves a
        little less room for words on every page — of every issue, including the
        ones you have already published. Nothing on the site breaks, but a page
        that was filled right to the bottom may now have a line too many. Open
        your fullest issues in the editor afterwards and have a look: it marks
        any page whose contents no longer fit, and offers to move the overflow
        onto the next page.
      </Callout>
      <P>
        <strong>Logos</strong>, further down the same screen, is a small library
        of the club&rsquo;s own marks — a crest, an emblem, a wordmark. Give
        each one a name, upload the picture once, and it&rsquo;s available to
        the rest of the magazine; rename it any time. It&rsquo;s separate from
        Sponsors, which is for other people&rsquo;s businesses.
      </P>
      <P>
        To put a mark on an issue, open that issue in the editor and choose it
        from the <strong>Logo</strong> box at the top. It then appears at the
        foot of every page with the club&rsquo;s name beside it. Choose{" "}
        <strong>None</strong> to go back to the plain footer. A mark that an
        issue is using can&rsquo;t be deleted until you change that
        issue&rsquo;s choice.
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
