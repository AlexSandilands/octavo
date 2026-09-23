"use client";

import { useState, useTransition } from "react";
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

  // Not `disabled` while saving, which would throw focus off the box. The
  // explainer is said once, in the section intro.
  return (
    <label className="text-ink flex min-h-11 w-fit cursor-pointer items-center gap-3 font-sans text-[15px] font-medium">
      <input
        type="checkbox"
        checked={checked}
        aria-label={`Show admin badge on ${name.name}`}
        onChange={(e) => {
          if (!pending) change(e.target.checked);
        }}
        className="accent-accent h-5 w-5 flex-none cursor-pointer"
      />
      Show admin badge
    </label>
  );
}
