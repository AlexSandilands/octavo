import { Callout, GuideSection, P } from "./guide-ui";

export function SectionBasics() {
  return (
    <GuideSection
      id="basics"
      kicker="The big picture"
      title="How the site works"
    >
      <P>
        The magazine is <strong>private</strong>. Nothing on it is public: every
        reader must be on the members list and signed in before they can see an
        issue.
      </P>
      <P>
        <strong>There are no passwords.</strong> A member types their email
        address on the sign-in page, and the site emails them a personal sign-in
        link — click it and they&rsquo;re in, and they stay signed in on that
        device for about three months. Only addresses on the members list get a
        link, and links go stale after a day, so there&rsquo;s nothing to leak
        and nothing to forget.
      </P>
      <P>
        You&rsquo;re an <strong>admin</strong>, so you also see this Admin area
        — where issues are written, published and managed. Ordinary members
        never see it. What they see is the <strong>library</strong> (every
        published issue) and the <strong>reader</strong>: on a computer the
        magazine opens like a real book with pages that turn; on a phone it
        reads as an easy scroll.
      </P>
      <Callout icon="help" title="If someone says they can’t get in">
        Check they&rsquo;re on the members list (see{" "}
        <a href="#members" className="text-accent underline">
          Members
        </a>{" "}
        below) and that they&rsquo;re typing the same email address you have for
        them. An old sign-in link may simply have expired — it&rsquo;s always
        safe to request a fresh one from the sign-in page. And ask them to peek
        in their spam folder.
      </Callout>
    </GuideSection>
  );
}
