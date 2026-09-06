import { signOutAction } from "@/app/signin/actions";

// The sign-out control — a text button in the masthead's dateline, shared by
// the member pages and the admin. Posts to signOutAction (deletes the session
// row, clears the cookie).
export function SignOutButton() {
  return (
    <form action={signOutAction} className="flex">
      <button
        type="submit"
        className="text-lead hover:text-red flex h-11 cursor-pointer items-center px-1 font-ui text-[15px] font-semibold whitespace-nowrap underline decoration-1 underline-offset-4 transition-colors hover:decoration-2"
      >
        Sign out
      </button>
    </form>
  );
}
