import { AssistantUsageHelp } from "./assistant-usage";
import { Bullets, Callout, GuideSection, P } from "./guide-ui";

// The editing assistant (epic #306): what it can do, the presets (#310), and
// Undo, and photos attached in the chat (#343). Shown only where the
// deployment offers it.
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
        It can also look. It can open your photos to put each one beside the
        story it belongs to, or to describe it for readers who use a screen
        reader. It can also see a page as members will. When a change runs over
        the cover or more than one page, it looks over those pages once more
        before it finishes and tidies anything that reads badly, so a bigger job
        takes a little longer.
      </P>
      <P>
        You can give it photos too. Press <strong>Attach photos</strong> (the
        picture button beside Send), paste a photo into the box, or drop photos
        onto the panel, up to ten a message. Each one is added to the
        issue&rsquo;s photos as it uploads, and shows as a small picture you can
        remove before sending. Then say what you&rsquo;d like, such as
        &ldquo;put these beside the stories they belong to&rdquo;. It looks at
        each photo to place it and to write its description; any it
        doesn&rsquo;t use stay with the issue&rsquo;s photos, and it says so.
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
        issue&rsquo;s text, its photos (including any you attach) and pictures
        of its pages are sent to the AI service to answer you, so don&rsquo;t
        paste or attach anything you wouldn&rsquo;t put in the magazine.
      </Callout>
      <AssistantUsageHelp />
    </GuideSection>
  );
}
