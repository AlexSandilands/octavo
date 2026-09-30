"use client";

import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/signin/actions";
import { Icon } from "./icons";

// The sign-out control, shared by the library header, the footer and the admin
// sidebar. Posts to signOutAction (deletes the session row, clears the cookie,
// redirects to /signin); the variants differ only in chrome.
export function SignOutButton({
  variant = "inline",
}: {
  variant?: "inline" | "sidebar";
}) {
  return (
    <form action={signOutAction}>
      <SignOutSubmit sidebar={variant === "sidebar"} />
    </form>
  );
}

// Disabled while the request is out, so a slow sign-out isn't pressed twice.
function SignOutSubmit({ sidebar }: { sidebar: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`text-muted hover:text-accent flex h-11 cursor-pointer items-center font-sans font-medium hover:underline disabled:cursor-wait disabled:opacity-60 ${
        sidebar ? "w-full gap-2 text-[14px]" : "text-sm whitespace-nowrap"
      }`}
    >
      {sidebar && <Icon name="chevronLeft" size={16} />}
      Sign out
    </button>
  );
}
