import { createHash } from "node:crypto";

// sessions.session_token stores sha256(cookie value) hex, so a read-only copy
// of the database holds no working logins. Not server-only: gate scripts that
// insert sessions directly hash with it too.
export function hashSessionToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
