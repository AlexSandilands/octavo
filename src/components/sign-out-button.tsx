import { signOutAction } from "@/app/signin/actions";
import { Icon } from "./icons";

// The sign-out control, shared by the library header and the admin sidebar.
// Both post to signOutAction (deletes the session row, clears the cookie);
// they differ only in chrome, so the layout picks a variant.
export function SignOutButton({
  variant = "inline",
  className = "",
}: {
  variant?: "inline" | "sidebar";
  className?: string;
}) {
  const sidebar = variant === "sidebar";
  const colorCls = className || "text-muted hover:text-accent";
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={`${colorCls} flex h-11 cursor-pointer items-center font-sans font-medium hover:underline ${
          sidebar ? "w-full gap-2 text-[14px]" : "text-sm whitespace-nowrap"
        }`}
      >
        {sidebar && <Icon name="chevronLeft" size={16} />}
        Sign out
      </button>
    </form>
  );
}
