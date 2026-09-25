import { Bullets, Callout, GuideSection, P } from "./guide-ui";

// The editing assistant (epic #306): what it can do, the presets (#310), the
// per-block Ask (#311), and Undo. Shown only where the deployment offers it.
// #314 adds how to see what it costs at the end of this section.
export function SectionAssistant() {
  return (
    <GuideSection
      id="assistant"
      kicker="Editing assistant"
      title="The assistant"
    >
      <P>
        The <strong>Assistant</strong> button (a small sparkle) on the right
        edge of the editor opens a chat beside the page you&rsquo;re working on.
        You ask in ordinary words, and it answers from the issue in front of it
        or makes the change for you: tidying a page, turning a list into
        bullets, rewriting or shortening text, moving or resizing a photo, or
        carrying the end of a full page onto a new one. Its changes appear on
        the page as it makes them.
      </P>
      <P>
        Four quick buttons sit above the box where you type. Each asks about the
        page you have open, or only the block you have selected on it:
      </P>
      <Bullets>
        <li>
          <strong>Tidy this page</strong> straightens spacing, punctuation and
          headings without changing your words.
        </li>
        <li>
          <strong>Make bullets</strong> turns a list written as running text
          into bullet points, keeping every word.
        </li>
        <li>
          <strong>Rewrite for clarity</strong> rewords the text. The wording
          will change, so read it through.
        </li>
        <li>
          <strong>Shorten to fit</strong> trims a page that runs over until it
          fits. The wording will change here too.
        </li>
      </Bullets>
      <P>
        To ask about one block without opening the panel, select the block and
        press <strong>Ask</strong> at its top right corner. Type what you want,
        such as &ldquo;make this a bulleted list&rdquo;, and press Enter. The
        panel opens to show the answer and what changed. Escape closes the box
        without sending anything. Ask isn&rsquo;t offered on the cover or on a
        full-page photo.
      </P>
      <P>
        When it has finished, a line in the panel says what changed, such as
        &ldquo;Changed 3 blocks on pages 4&ndash;5&rdquo;, with an{" "}
        <strong>Undo</strong> button. Undo, or Ctrl+Z (&#8984;Z on a Mac), takes
        back everything it did in one step. If it goes round in circles it stops
        itself and says so; what it had done stays, and can be undone the same
        way.
      </P>
      <Bullets>
        <li>
          <strong>Drafts only.</strong> On a published issue the panel says so
          and offers nothing else; the assistant works on the next issue you
          start.
        </li>
        <li>
          <strong>On the cover</strong> the cover settings panel steps aside
          while the assistant is open, and comes back when you close it.
        </li>
        <li>
          <strong>It costs money.</strong> Every question is sent to an AI
          service, which charges for it. The site owner sees what&rsquo;s been
          spent, and the foot of the panel shows this month&rsquo;s total
          against the allowance. When the allowance is used up the assistant
          stops until next month, or until the owner adds more.
        </li>
        <li>
          <strong>A long conversation fills up.</strong> The panel then offers
          to start a new one; the issue itself is untouched.
        </li>
      </Bullets>
      <Callout tone="careful" title="You’re responsible for what it writes">
        The assistant can misread a page or get a detail wrong, and a rewrite
        can change what a sentence means. Read what it tells you and what it
        changed before relying on it, and check the page itself. The
        issue&rsquo;s text and photos are sent to the AI service to answer you,
        so don&rsquo;t paste anything into the chat you wouldn&rsquo;t put in
        the magazine.
      </Callout>
    </GuideSection>
  );
}
