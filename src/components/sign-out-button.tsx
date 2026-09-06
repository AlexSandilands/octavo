import { signOutAction } from "@/app/signin/actions";
import { Button } from "./ui";

// The sign-out control, shared by the site bar, the site footer and the phone
// menu. All post to signOutAction (deletes the session row, clears the cookie);
// they differ only in chrome — a quiet ghost button on the dark ground, or a
// full-width outlined one at the foot of the phone menu.
export function SignOutButton({ full = false }: { full?: boolean }) {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant={full ? "secondary" : "ghost"}
        tone="dark"
        size={full ? "md" : "sm"}
        icon="logout"
        iconPosition="left"
        full={full}
      >
        Sign out
      </Button>
    </form>
  );
}
