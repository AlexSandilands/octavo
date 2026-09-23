"use client";

import type { RemovedMemberComments } from "@/lib/branding";
import type { SettingsForm } from "./magazine-settings";
import { SettingsToggle } from "./settings-toggle";

// The discussion settings (issue #302): the site-wide switch, which ships off
// and is how the club turns discussion on, and what a removed member's
// comments become. Part of the one settings form, saved with everything else.

const REMOVAL_CHOICES: Record<
  RemovedMemberComments,
  { label: string; hint: string }
> = {
  anonymise: {
    label: "Keep their comments as “Former member”",
    hint: "The words stay, so replies still make sense, with no name or picture on them.",
  },
  delete: {
    label: "Delete their comments",
    hint: "Their replies go. A comment of theirs that someone answered stays as “Comment removed”, so the answers still read.",
  },
};

// Anonymise first: it is the default and the gentler choice.
const REMOVAL_ORDER: RemovedMemberComments[] = ["anonymise", "delete"];

export function DiscussionSettings({
  form,
  onChange,
}: {
  form: SettingsForm;
  onChange: (patch: Partial<SettingsForm>) => void;
}) {
  return (
    <>
      <div className="border-line-soft border-t pt-5">
        <h3 className="text-ink font-serif text-lg leading-tight">
          Discussion
        </h3>
        <p className="text-muted mt-1.5 font-sans text-[13px] leading-relaxed">
          A place under each issue for members to talk about it. It starts
          switched off; nothing appears to members until you turn it on here.
        </p>
      </div>
      <SettingsToggle
        id="comments-enabled"
        label="Let members discuss each issue"
        hint="Every issue gets a discussion thread members can post and reply in, members choose the names they post under on their profile, and they can ask to be emailed when someone replies to them."
        detail={
          <>
            Turn it off and the threads, the comment counts, the reply bell and
            the reply emails are hidden everywhere, and nobody can post. Every
            comment is kept, so switching it back on brings the discussion back
            as it was. You can still look after reports while it is off.
          </>
        }
        value={form.commentsEnabled}
        onChange={(commentsEnabled) => onChange({ commentsEnabled })}
      />

      <fieldset aria-describedby="removed-member-comments-hint">
        <legend className="text-ink font-sans text-[14px] font-semibold">
          When a member is removed
        </legend>
        <p
          id="removed-member-comments-hint"
          className="text-faint2 mt-1 font-sans text-[12px] leading-relaxed"
        >
          Applies to members you remove from now on. Comments of anyone removed
          before stay as they are. Either way their pictures are deleted.
        </p>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {REMOVAL_ORDER.map((value) => (
            <label
              key={value}
              className="boxed-field border-hair flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] bg-white p-4"
            >
              <input
                type="radio"
                name="removed-member-comments"
                value={value}
                checked={form.removedMemberComments === value}
                onChange={() => onChange({ removedMemberComments: value })}
                aria-describedby={`removed-member-comments-${value}`}
                className="accent-accent mt-0.5 h-5 w-5 flex-none"
              />
              <span className="font-sans text-[14px] leading-snug">
                <span className="text-ink font-semibold">
                  {REMOVAL_CHOICES[value].label}
                </span>
                <span
                  id={`removed-member-comments-${value}`}
                  className="text-muted mt-0.5 block"
                >
                  {REMOVAL_CHOICES[value].hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
