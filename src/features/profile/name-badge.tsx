"use client";

import { useId, useState, useTransition } from "react";
import { setBadgeAction } from "@/app/profile/actions";
import type { ProfileName } from "@/server/member-profile";
import type { Announce } from "./names-shared";

// Admins only: whether comments under this name carry the Admin badge. The
// box shows the saved state again if the save is refused.
export function NameBadge({
  name,
  announce,
}: {
  name: ProfileName;
  announce: Announce;
}) {
  const id = useId();
  const [checked, setChecked] = useState(name.badge);
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      const result = await setBadgeAction(name.id, next);
      if (!result.ok) {
        setChecked(!next);
        announce(result.reason);
        return;
      }
      announce(
        next
          ? `Comments as “${name.name}” now show an Admin badge.`
          : `Comments as “${name.name}” no longer show an Admin badge.`,
      );
    });
  };

  // Not `disabled` while saving, which would throw focus off the box.
  return (
    <label className="boxed-field border-hair mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border-[1.5px] bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        aria-label={`Show admin badge on ${name.name}`}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          if (!pending) change(e.target.checked);
        }}
        className="accent-accent mt-0.5 h-5 w-5 flex-none cursor-pointer"
      />
      <span className="font-sans text-[14px] leading-snug">
        <span className="text-ink font-semibold">Show admin badge</span>
        <span id={`${id}-hint`} className="text-muted mt-0.5 block">
          Comments posted under this name show an Admin badge. Post under a name
          without it to join in as an ordinary member.
        </span>
      </span>
    </label>
  );
}
