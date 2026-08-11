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
        The file itself takes no looking after. It&rsquo;s made automatically
        the first time someone asks for it and reused after that; if you change
        the issue, the next download quietly rebuilds a fresh copy. That first
        download after a change can take a few extra seconds while the new copy
        is prepared — that&rsquo;s normal.
      </P>
      <P>
        What you do decide is whether to offer downloads at all. There&rsquo;s a
        switch under <strong>Magazine details</strong> —{" "}
        <em>Let members download issues as a PDF</em> — and turning it off takes
        the button away everywhere and stops the download working, even for a
        member who saved the link. Some clubs prefer that: a PDF can leave the
        members&rsquo; site and be passed on to anyone. Turn it back on and
        everything returns at once; nothing is lost in the meantime.
      </P>
    </GuideSection>
  );
}
