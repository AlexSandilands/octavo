import { signOutAction } from "@/app/signin/actions";
import { Icon } from "./icons";

// The sign-out control, shared by the shell's sidebar, the Account page and
// the admin "More" sheet. All post to signOutAction (deletes the session row,
// clears the cookie); they differ only in chrome, so the caller picks a variant.
export function SignOutButton({
  variant = "inline",
}: {
  variant?: "inline" | "row" | "pill";
}) {
  const cls = {
    // A text link in a footer.
    inline:
      "text-fg-muted hover:text-primary hover:bg-primary-wash inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-3 font-ui text-[16px] font-bold transition-colors",
    // A nav row in the sidebar / the More sheet.
    row: "text-fg-muted hover:bg-primary-wash hover:text-primary flex h-12 w-full cursor-pointer items-center gap-3 rounded-field px-3 font-ui text-[17px] font-bold transition-colors",
    // A full-width secondary pill (the Account page).
    pill: "border-edge text-fg hover:border-primary hover:bg-primary-wash hover:text-primary bg-surface flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] font-ui text-[16px] font-bold transition-colors",
  }[variant];
  return (
    <form
      action={signOutAction}
      className={variant === "inline" ? "" : "w-full"}
    >
      <button type="submit" className={cls}>
        <Icon name="signOut" size={20} strokeWidth={2} />
        Sign out
      </button>
    </form>
  );
}
