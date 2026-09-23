import { permanentRedirect } from "next/navigation";

// Email preferences became part of the member profile (issue #300). A route
// handler rather than a page, so the 308 is a real status and not a streamed
// meta refresh; kept because the old address is already in members' inboxes.
export function GET() {
  permanentRedirect("/profile");
}
