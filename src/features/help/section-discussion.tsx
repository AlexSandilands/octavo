import { Bullets, Callout, GuideSection, P } from "./guide-ui";

// The discussion and its moderation (issues #301, #302, #303): switching it on,
// where members find it, the reply bell and emails they receive, the reports
// inbox and its emails, and the removed-member setting.
export function SectionDiscussion() {
  return (
    <GuideSection
      id="discussion"
      kicker="Keeping it civil"
      title="Discussion and reports"
    >
      <P>
        Each issue can have a <strong>discussion</strong> under it, where
        members post comments and reply to one another under the names they
        choose on their profile. It starts switched off. Turn it on under{" "}
        <strong>Magazine details</strong> with{" "}
        <em>Let members discuss each issue</em>, and press Save. Turning it off
        later hides the threads, the comment counts, the reply bell and the
        reply emails everywhere and stops anyone posting — but every comment is
        kept, so turning it on again brings the discussion back as it was.
      </P>
      <P>
        Members find it in the reader behind a round green button with a speech
        bubble on it: on a computer it sits in the top right corner and opens a
        panel from the right, over the pages; on a phone it sits in the bottom
        right corner and raises the discussion from the bottom of the screen.
        Members can post, reply to a comment (one level deep — the replies fold
        away under a &ldquo;2 replies&rdquo; button until opened), and edit or
        delete their own comments; &ldquo;Posting as&rdquo; under the box picks
        which of their names a comment goes under, and someone posting for the
        first time chooses their name right there. The library shows how many
        comments each issue has.
      </P>
      <P>
        When someone replies to a member&rsquo;s comment, the member sees it on
        a <strong>bell</strong> at the top of the library, beside their picture,
        with the number of new replies on it. Pressing the bell lists the latest
        replies (&ldquo;Ada replied to your comment on Issue 14&rdquo; — on an
        account two people share, whose comment it was); choosing one opens the
        issue with the discussion on that reply. Members can also ask for an{" "}
        <strong>email</strong> for every reply, under <em>Email → Replies</em>{" "}
        on their profile (it starts off). It quotes their comment and the start
        of the reply, and its <em>Read the reply</em> button signs them in and
        opens the reply — like the new-issue email, the button works once and
        for a day. <em>Stop reply emails</em> at the bottom turns these off
        without touching new-issue emails. Replying to yourself sends nothing,
        and a reply you hide leaves the bell — but an email already sent
        can&rsquo;t be taken back.
      </P>
      <P>
        As an admin you see the same thread, with the member account behind each
        name written under it. Deleting an issue deletes its discussion too —
        the confirmation says how many comments go with it. Discussion never
        appears in the PDF.
      </P>
      <P>
        Any member can <strong>report</strong> someone else&rsquo;s comment,
        choosing a reason and adding a note if they like. The report keeps a
        copy of the comment exactly as it read at that moment, so editing or
        deleting it afterwards can&rsquo;t hide what was said.
      </P>
      <P>
        Reports arrive in <strong>Reports</strong> in the menu, which shows how
        many are open; the Issues page says so too. Each one shows the comment
        as reported, the name it was posted under and the member account behind
        that name, and — if it has changed since — what became of it: edited
        (with the new wording), deleted by its author, or removed by an admin.
        Below that are the issue it was on, the reason and note, and who
        reported it. Search covers the comment, the name and the reporter;{" "}
        <em>Show</em> switches between open, resolved and all reports.
      </P>
      <P>What you can do with a report:</P>
      <Bullets>
        <li>
          <strong>Hide comment</strong> takes it out of sight for members. It
          can be undone with <strong>Unhide comment</strong>.
        </li>
        <li>
          <strong>Delete comment</strong> removes it for good (you&rsquo;re
          asked first). If people replied to it, their replies stay under
          &ldquo;Comment removed&rdquo;. Members can&rsquo;t tell a hidden
          comment from a deleted one.
        </li>
        <li>
          Hiding or deleting also <strong>resolves every open report</strong> on
          that comment, so three reports of one comment are dealt with at once.
        </li>
        <li>
          <strong>Resolve</strong> closes the report and leaves the comment as
          it is — for a report you&rsquo;ve looked at and decided needs nothing.
        </li>
        <li>
          <strong>Clear avatar</strong> removes the picture on the name the
          comment was posted under, and <strong>Retire name</strong> takes the
          name off the member&rsquo;s list so they can&rsquo;t post under it
          again. Comments already posted keep the name.
        </li>
      </Bullets>
      <P>
        Every admin gets an <strong>email</strong> when a comment is reported,
        with the reason, the start of the comment and a button to the inbox. To
        stop a busy day filling your inbox, at most one is sent every 15
        minutes; the next one after a quiet spell says how many reports are
        open. The inbox always has every report, emailed or not.
      </P>
      <Callout title="When you remove a member">
        <p>
          Under <strong>Magazine details</strong> you choose what happens to a
          removed member&rsquo;s comments: kept, shown as &ldquo;Former
          member&rdquo; with no name or picture (the default), or deleted. The
          choice applies to members you remove from then on, not to anyone
          removed before. When you remove someone on the Members page, the
          confirmation tells you how many comments they have and which of the
          two will happen. Their profile pictures are deleted either way.
        </p>
      </Callout>
    </GuideSection>
  );
}
