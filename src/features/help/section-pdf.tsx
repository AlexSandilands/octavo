import { GuideSection, P } from "./guide-ui";

export function SectionPdf() {
  return (
    <GuideSection id="pdf" kicker="Copies to keep" title="PDF downloads">
      <P>
        Members can download any published issue as a <strong>PDF</strong> —
        there&rsquo;s a download button in the reader and next to the latest
        issue in the library. It&rsquo;s handy for printing or for reading
        offline, and like everything else it&rsquo;s members-only.
      </P>
      <P>
        There&rsquo;s nothing for you to manage. The PDF is made automatically
        the first time someone asks for it and reused after that; if you change
        the issue, the next download quietly rebuilds a fresh copy. That first
        download after a change can take a few extra seconds while the new copy
        is prepared — that&rsquo;s normal.
      </P>
    </GuideSection>
  );
}
