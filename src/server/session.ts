import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEMO_MODE } from "@/lib/demo";
import { auth } from "./auth";

// The session helpers the rest of the app uses — components and actions call
// these, never Auth.js directly. cache() dedupes the session lookup within a
// single request no matter how many components ask.

export const getSession = cache(async () => auth());

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// Fail closed, but loudly: a session-lookup error reads as signed out, and
// the underlying error is logged so an infrastructure failure can't silently
// masquerade as a 403.
export async function getUserFailClosed() {
  try {
    return await getUser();
  } catch (err) {
    console.error("[auth] session lookup failed (denying):", err);
    return null;
  }
}

// The single admin-or-not decision.
export async function getAdminUser() {
  const user = await getUserFailClosed();
  return user?.isAdmin ? user : null;
}

// The gate for server actions and route handlers: call it before touching
// anything. Throwing (rather than returning) means a forgotten check on the
// result can't fail open.
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("Admin session required");
  return user;
}

// The gate for /admin pages and the layout: same decisions, redirect instead
// of throw — signed out to /signin, signed-in non-admins to the library.
export async function requireAdminOrRedirect() {
  const user = await getUserFailClosed();
  if (!user) redirect("/signin");
  if (!user.isAdmin) redirect("/");
  return user;
}

// The gate for member-facing pages (library, reader): signed-out visitors go
// to /signin carrying the destination, so the link in a new-issue email lands
// them on that issue after signing in — members with a live session never see
// the gate at all.
//
// In demo mode (issue #50) a signed-out visitor is allowed through and the
// caller receives null — the return type forces every member page to decide
// what its signed-in affordances do for an anonymous visitor. The admin gates
// above are deliberately untouched by the flag.
export async function requireMemberOrRedirect(next: string) {
  const user = await getUserFailClosed();
  if (!user) {
    if (DEMO_MODE) return null;
    redirect(
      next === "/" ? "/signin" : `/signin?next=${encodeURIComponent(next)}`,
    );
  }
  return user;
}
