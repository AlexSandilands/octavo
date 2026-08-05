import { MagazineFigure } from "./magazine-figure";
import { Callout, GuideSection, P, Step, Steps } from "./guide-ui";

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
      <MagazineFigure />
      <Steps>
        <Step n={1} title="Details — what the magazine is called">
          Three pieces of wording, each of which turns up somewhere different.{" "}
          <strong>Magazine name</strong> is the masthead over the library, and
          the title of every email that goes out.{" "}
          <strong>Club or organisation</strong> is who publishes it — the
          wording that sits beside your mark at the foot of every page.{" "}
          <strong>Tagline</strong> is the single line under the club name on the
          library page. Every box is optional: leave one empty and the magazine
          falls back to the wording it was set up with when the site was
          installed, and the note under the box tells you what that is. Clearing
          a field never leaves the magazine nameless.
        </Step>
        <Step n={2} title="Page footer — how the foot of a page is set">
          Three choices that decide the look of the running footer: how big the
          mark is, how big the wording is, and whether the lockup sits on the
          left, in the middle or on the right — the page number always takes the
          opposite margin, on both leaves of a spread and on a phone. These are
          settings for the whole magazine, not for one issue: they apply at once
          everywhere a page is drawn — the reader, the editor, the PDF, and
          issues you have already published.
        </Step>
        <Step n={3} title="The page beside them, before you save">
          The picture on the right is a real magazine page, drawn by the same
          parts the reader and the PDF use, from the choices currently in the
          form — so it shows the footer you are about to have, not the one the
          site has now. Its own two boxes, <strong>Theme</strong> and{" "}
          <strong>Mark</strong>, are not settings and nothing about them is
          saved: the layout theme and the mark are chosen per issue, and they
          are offered here only so you can look at the combination you care
          about.
        </Step>
        <Step n={4} title="Logos — the club’s own marks">
          A small library of the club&rsquo;s marks — a crest, an emblem, a
          wordmark. Give each one a name, upload the picture once, and it is
          available to the rest of the magazine; rename it any time. Adding,
          renaming and deleting all happen straight away — that box has no Save
          button of its own and does not use the one above it. It&rsquo;s
          separate from Sponsors, which is for other people&rsquo;s businesses.
        </Step>
        <Step n={5} title="Save changes — one button for the lot">
          The wording and the footer settings are one form with one button, so
          the whole screen commits together. Until you press it nothing has
          changed anywhere but that preview, and the line beside the button
          tells you which of the two you are looking at. Once saved, it is live
          on the site immediately.
        </Step>
      </Steps>
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
        A mark only reaches an issue when that issue asks for it. To put one on,
        open the issue in the editor and choose it from the{" "}
        <strong>Logo</strong> box at the top; it then appears at the foot of
        every page with the club&rsquo;s name beside it, set the way you chose
        here. Choose <strong>None</strong> to go back to the plain footer. A
        mark that an issue is using can&rsquo;t be deleted until you change that
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
