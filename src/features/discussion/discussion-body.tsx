"use client";

import { Button, IconButton } from "@/components/ui";
import { DiscussionThread } from "./discussion-thread";
import type { ReaderPages } from "./page-tags";
import type { Discussion } from "./use-discussion";

// What both shells hold (issue #301): the heading and close button, then the
// thread — or, for demo mode's signed-out visitor, only the way in. Nothing
// about the thread is fetched for them.
export function DiscussionBody({
  talk,
  pages,
  titleId,
  grip,
}: {
  talk: Discussion;
  pages: ReaderPages;
  titleId: string;
  /** The sheet's swipe handle, above the heading. */
  grip?: React.ReactNode;
}) {
  const { issueNo, signedIn } = talk.info;
  const next = `/read/${issueNo}?discussion=1`;
  return (
    <>
      {grip}
      <div className="border-line flex flex-none items-center justify-between gap-3 border-b py-3 pr-4 pl-5">
        <h2
          id={titleId}
          className="text-ink font-serif text-[21px] leading-tight"
        >
          Discussion · Issue {issueNo}
        </h2>
        <IconButton
          icon="close"
          label="Close discussion"
          onClick={talk.hide}
          className="h-11 w-11"
        />
      </div>
      {signedIn ? (
        <DiscussionThread talk={talk} pages={pages} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
          <p className="text-ink font-serif text-[22px] leading-snug">
            Discussion is for members.
          </p>
          <Button
            href={`/signin?next=${encodeURIComponent(next)}`}
            reload
            icon="arrowRight"
          >
            Sign in to join the discussion
          </Button>
        </div>
      )}
    </>
  );
}
