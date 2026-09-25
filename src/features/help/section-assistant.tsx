import { Bullets, Callout, GuideSection, P } from "./guide-ui";

// The editing assistant (epic #306). Shown only where the deployment offers it.
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
        You ask in ordinary words, and it answers from the issue in front of it:
        what&rsquo;s on a page, which pages are nearly full, where an article
        starts. For now it only reads the issue; it can&rsquo;t change anything
        yet.
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
        The assistant can misread a page or get a detail wrong. Read what it
        tells you before relying on it, and check the page itself. The
        issue&rsquo;s text and photos are sent to the AI service to answer you,
        so don&rsquo;t paste anything into the chat you wouldn&rsquo;t put in
        the magazine.
      </Callout>
    </GuideSection>
  );
}
