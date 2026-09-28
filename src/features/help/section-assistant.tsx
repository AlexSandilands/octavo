import { AssistantUsageHelp } from "./assistant-usage";
import { Bullets, Callout, GuideSection, P } from "./guide-ui";

// The editing assistant (epic #306): what it can do, the presets (#310) and
// their rotating hints and suggested follow-ups (#366), the per-block Ask
// (#311), the cover (#313), photos attached in the chat (#343), Undo, and a
// long paste (#312). Shown only where the deployment offers it. It
// closes with what the assistant has cost this month (#314).
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
        bullets, rewriting or shortening text, moving or resizing a photo,
        carrying the end of a full page onto a new one, or composing the cover.
        Its changes appear on the page as it makes them.
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
        Looking at photos fills a conversation quickly: after a message or two
        with many photos the panel may say the conversation is full, and offer
        to start a new one.
      </P>
      <P>
        Four quick buttons sit above the box where you type. Each asks about the
        page you have open, or only the block you have selected on it. They
        change as you work, suggesting things that suit the page (such as
        captions when it has photos), and <strong>More ideas</strong> shows
        others. Among them:
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
          fits. The wording will change here too. It is always there while the
          page runs over.
        </li>
      </Bullets>
      <P>
        When the assistant offers to do something more, a button under its
        answer, marked <em>Suggested by the assistant</em>, sends its offer on
        for you; the words it will send are printed beneath it. The same words
        show faintly in the empty box where you type: press Tab to use them, or
        just type your own.
      </P>
      <P>
        To ask about one block without opening the panel, select the block and
        press <strong>Ask</strong> at the end of its tool bar. Type what you
        want, such as &ldquo;make this a bulleted list&rdquo;, and press Enter.
        The panel opens to show the answer and what changed. Escape closes the
        box without sending anything. Ask works on the cover&rsquo;s items too,
        but not on a full-page photo or the cover&rsquo;s background.
      </P>
      <P>
        On the cover the buttons give way to the cover&rsquo;s own, led by{" "}
        <strong>Compose cover</strong>, which leads with the issue&rsquo;s
        strongest story and keeps the photo already there. You can also ask for
        a cover in your own words, such as &ldquo;put the evening photo on the
        cover, lead with the twilight league, and add the date and our
        logo&rdquo;. It sets the background, the masthead, stories linked to
        their pages, the issue details and a logo from your library, and places
        and colours them. The typefaces stay yours to choose in the cover
        settings. Asked from an inside page, it works on the front cover.
      </P>
      <P>
        When it has finished, a line in the panel says what changed, such as
        &ldquo;Changed 3 blocks on pages 4&ndash;5&rdquo;, with an{" "}
        <strong>Undo</strong> button. Undo, or Ctrl+Z (&#8984;Z on a Mac), takes
        back everything it did in one step. If it goes round in circles it stops
        itself and says so; what it had done stays, and can be undone the same
        way.
      </P>
      <P>
        <strong>Pasting a long document.</strong> You can paste several articles
        into the chat at once and ask for them to be laid out as new pages. It
        plans each article, with its headline, the small label above it and the
        introduction under it, then places every one at the top of a fresh page,
        adding pages where an article runs long. Anything over about 4,000
        characters, typed in the chat or in an Ask box, asks first in the panel
        with a rough cost, because laying it out costs more than a normal
        question; you can always paste it onto the page yourself and ask the
        assistant to tidy it. Where an article would suit a photo you
        haven&rsquo;t uploaded, the line at the end says so.
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
