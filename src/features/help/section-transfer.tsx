import { Callout, GuideSection, P, Step, Steps } from "./guide-ui";

export function SectionTransfer() {
  return (
    <GuideSection
      id="transfer"
      kicker="Moving issues between sites"
      title="Export and import issues"
    >
      <P>
        If you write an issue on one copy of this site — a practice site, or a
        version running on your own computer — you can carry it across to this
        one as a single file, rather than typing it all out again. Everything
        the issue needs travels with it: the pages, the photographs, and the
        sponsors and logos it uses.
      </P>
      <Steps>
        <Step n={1} title="Export from the first site">
          On the <strong>Issues</strong> screen, tick the issues you want and
          press <strong>Export selected</strong>. A single file downloads, named
          for today&rsquo;s date. One issue or a dozen — it&rsquo;s the same
          file.
        </Step>
        <Step n={2} title="Import on this one">
          Press <strong>Import issues</strong> at the top of the Issues screen
          and choose that file. Before anything is sent, you&rsquo;ll see a list
          of what it holds and what will happen to each one.
        </Step>
        <Step n={3} title="Finish and publish as usual">
          Everything arrives as a <strong>new draft</strong>, with no issue
          number. Open it, look it over, and publish when you&rsquo;re ready —
          importing never tells members anything.
        </Step>
      </Steps>
      <Callout title="What may look different afterwards">
        The words, the pages and the photographs come across exactly. The
        wrapping does not: this site&rsquo;s own magazine name, footer and issue
        numbers are used. And where a sponsor or a logo with the same name is
        already here, the one already here is kept — your existing details and
        artwork are never overwritten by the file.
      </Callout>
      <Callout tone="careful" icon="help" title="If it won’t go through">
        An import either works completely or changes nothing at all, and it
        always says why it stopped. Two answers are worth knowing. &ldquo;More
        than one sponsor called…&rdquo; means this site has two entries with the
        same name and the import can&rsquo;t tell which you meant — rename or
        remove one and try again. &ldquo;Made by a newer version of the
        site&rdquo; means the other copy is ahead of this one; update this site
        first. If the connection drops part-way, leave the window open and press{" "}
        <strong>Retry</strong>: it asks what happened rather than importing
        everything twice.
      </Callout>
    </GuideSection>
  );
}
