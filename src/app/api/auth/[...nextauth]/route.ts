import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/next-path";
import { handlers } from "@/server/auth";

// No POST: its sign-in endpoint would mail a link around requestMagicLink's
// rate limits. The app never needs it — signIn()/signOut() from @/server/auth
// run Auth() in-process, and the emailed link is a GET. Next answers 405.

// An emailed link that no longer works (used, or a day old) sends Auth.js to
// /signin?error=Verification without where the link was headed. Carry its
// callbackUrl across as ?next=, so the fresh link the member asks for lands
// them in the same place — the reply they were opening, say (issue #303).
export async function GET(req: NextRequest): Promise<Response> {
  const res = await handlers.GET(req);
  const location = res.headers.get("location");
  const callback = req.nextUrl.searchParams.get("callbackUrl");
  if (!location || !callback) return res;
  const url = new URL(location, req.nextUrl);
  const next = safeNextPath(callback);
  if (
    url.pathname !== "/signin" ||
    !url.searchParams.has("error") ||
    url.searchParams.has("next") ||
    next === "/"
  ) {
    return res;
  }
  url.searchParams.set("next", next);
  const headers = new Headers(res.headers);
  headers.set("location", url.toString());
  return new Response(res.body, { status: res.status, headers });
}
