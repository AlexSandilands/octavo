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
      <Callout title="Full-page cover photos">
        Select a cover image and choose <strong>Fill page</strong> to crop it
        edge to edge, or <strong>Fit page</strong> to show the whole image with
        page-coloured space around it. Other cover blocks stay editable over the
        photo; click the photo itself to change or replace it. For an image-only
        cover, remove the blocks you don&rsquo;t need. The cover inspector
        beside the page offers a background panel, magazine colour swatches and
        a custom colour. Text colour, shadow colour and shadow strength are
        independent. Fonts stay consistent with the magazine. Choose a panel for
        busy photos, and preview both phone and desktop layouts. Selecting
        another background returns the previous photo to a normal image block.
        Returning to normal placement restores the image&rsquo;s previous width;
        turning off cover styling returns a cover with overlays to ordinary
        flow. These changes can all be undone.
      </Callout>
      <Callout title="Arrange your cover">
        On a cover the <strong>Text</strong> button in the toolbar opens a menu:{" "}
        <strong>Paragraph</strong> for an ordinary block of words,{" "}
        <strong>Story</strong> for a story or a list of them, and{" "}
        <strong>Details</strong> for the issue number and a date or edition. A
        Story holds one story, or up to six under an optional list heading, and{" "}
        <strong>Headline size</strong> in the inspector sets how large their
        headlines print. Use <strong>Logo</strong> to add a mark from your
        library. These are optional on both plain and photo covers. A story can
        follow a heading from a later page or stand on its own; a custom cover
        headline leaves the original section title unchanged. Click an element
        on the page to edit it in the inspector beside the page (drag its handle
        to park it on the other side). Keep{" "}
        <strong>Use cover appearance</strong>
        checked to follow the cover defaults, or uncheck it to customise the
        element. Select words on the page to make them bold, italic or
        underlined, or give them a colour or shadow, from the small bar above
        the element. Use the + swatch for a custom colour. Logo size is
        adjustable. Use the on-page drag handle to reorder items, the layer
        buttons to bring an item in front of or behind one it overlaps, or the
        trash button to remove one. Click any heading, text block or photo to
        use the same placement controls; edit words directly on the page.
        Elements at the same position stack in order; phones show them in a
        readable column. Under <strong>Needs attention</strong> the inspector
        names anything that overlaps or runs past the margin; point at a line to
        see the item, press it to select it. Use Undo to recover a removed
        element.
      </Callout>
      <Callout title="Editing an issue that’s already published">
        There&rsquo;s no separate &ldquo;working copy&rdquo;. Once an issue is
        published, anything you change in the editor is saved straight into the
        live issue — members see it the next time they open it. Perfect for
        fixing a typo; worth remembering before starting a big rework.
      </Callout>
    </GuideSection>
  );
}
