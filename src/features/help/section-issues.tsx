import { EditorFigure } from "./editor-figure";
import { Callout, GuideSection, P, Step, Steps } from "./guide-ui";

export function SectionIssues() {
  return (
    <GuideSection id="issues" kicker="Writing" title="Create and edit an issue">
      <P>
        Everything starts on the <strong>Issues</strong> screen. Press the
        create button and a fresh draft opens in the editor. A draft is
        completely private — members see nothing until you publish it, so you
        can take your time.
      </P>
      <EditorFigure />
      <Steps>
        <Step n={1} title="Name it — and let it save itself">
          Click the title in the top-left corner and type over it. The editor{" "}
          <strong>saves by itself</strong> a moment after every change — watch
          the little &ldquo;Saved&rdquo; note beside the title. There is no save
          button, and closing the tab loses nothing. If it ever says it
          couldn&rsquo;t save, press the retry button it offers.
        </Step>
        <Step n={2} title="Build the pages">
          The rail down the left lists the issue&rsquo;s pages. Add one with the{" "}
          <strong>+</strong> tile (you&rsquo;ll pick a starting layout), drag a
          thumbnail up or down to reorder, or remove a page from its thumbnail.
          The first page is always the cover — the editor keeps it there for
          you.
        </Step>
        <Step n={3} title="Fill each page with blocks">
          A page is a stack of blocks: <strong>headings</strong>,{" "}
          <strong>text</strong>, <strong>images</strong> and{" "}
          <strong>sponsor cards</strong>. Add one from the Insert row above the
          page, then click any block to write in it, move it, or remove it. For
          an image, just choose a photo from your computer — the site resizes
          and compresses it for you, so big photos straight off a phone are
          fine.
        </Step>
        <Step n={4} title="Preview before you share">
          The <strong>Preview</strong> button (top right) shows the issue
          exactly as members will see it, page-turning and all. It&rsquo;s only
          a look — previewing never publishes anything, and only admins can see
          it.
        </Step>
      </Steps>
      <Callout title="Editing an issue that’s already published">
        There&rsquo;s no separate &ldquo;working copy&rdquo;. Once an issue is
        published, anything you change in the editor is saved straight into the
        live issue — members see it the next time they open it. Perfect for
        fixing a typo; worth remembering before starting a big rework.
      </Callout>
    </GuideSection>
  );
}
