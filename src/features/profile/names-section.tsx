"use client";

import { useRef, useState } from "react";
import type { ProfileName } from "@/server/member-profile";
import { AddNameForm } from "./add-name-form";
import { NameRow } from "./name-row";
import { SHARED_NOTE, type Announce, type NameRules } from "./names-shared";

// "Names you post under" (issue #300). Every result is spoken through the one
// polite live region at the foot of the section.
export function NamesSection({
  names,
  isAdmin,
  suggestion,
  accountName,
  reserved,
}: {
  names: ProfileName[];
  isAdmin: boolean;
  suggestion: string;
  accountName: string | null;
  reserved: string[];
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  // One name's panel open at a time; opening another closes it.
  const [openId, setOpenId] = useState<string | null>(null);
  // Names saved this visit that another member also uses; the note stays by them.
  const [shared, setShared] = useState<ReadonlySet<string>>(new Set());
  const rules: NameRules = { reserved, accountName };

  const announce: Announce = (text, isShared = false) => {
    const next = isShared ? `${text} ${SHARED_NOTE}` : text;
    // Cleared first, so the same sentence twice is still read out.
    setMessage("");
    requestAnimationFrame(() => setMessage(next));
  };
  const markShared = (nameId: string, isShared = true) =>
    setShared((current) => {
      const next = new Set(current);
      if (isShared) next.add(nameId);
      else next.delete(nameId);
      return next;
    });
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus());

  return (
    <section aria-labelledby="names-heading" className="mt-8">
      <h2
        id="names-heading"
        ref={heading}
        tabIndex={-1}
        className="text-ink font-serif text-2xl outline-none"
      >
        Names you post under
      </h2>
      <p className="text-muted mt-2 font-sans text-[15px] leading-relaxed">
        These are the names other members see on your comments. If you share
        this account with someone, add a name for each of you — you’ll choose
        which one when you post. They’re separate from the name the club holds
        for you.
      </p>
      {isAdmin && (
        <p className="text-muted mt-2 font-sans text-[15px] leading-relaxed">
          As an admin you can show an Admin badge on a name’s comments. Post
          under a name without the badge to join in as an ordinary member.
        </p>
      )}

      {names.length > 0 && (
        <ul className="mt-4">
          {names.map((name) => (
            <NameRow
              key={name.id}
              name={name}
              open={openId === name.id}
              onOpen={() => setOpenId(name.id)}
              onClose={() => setOpenId(null)}
              isAdmin={isAdmin}
              isOnly={names.length === 1}
              shared={shared.has(name.id)}
              rules={rules}
              announce={announce}
              onShared={markShared}
              onRemoved={focusHeading}
            />
          ))}
        </ul>
      )}
      <AddNameForm
        count={names.length}
        suggestion={suggestion}
        rules={rules}
        announce={announce}
        onShared={markShared}
        onFull={focusHeading}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
    </section>
  );
}
