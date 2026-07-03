import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

// The session helpers the rest of the app uses — components and actions call
// these, never Auth.js directly. cache() dedupes the session lookup within a
// single request no matter how many components ask.

export const getSession = cache(async () => auth());

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// The single admin-or-not decision. Fail closed: signed out, not an admin,
// or the session lookup itself erroring all come back null — but an actual
// error is logged, or an infrastructure failure would masquerade as a 403.
export async function getAdminUser() {
  try {
    const user = await getUser();
    return user?.isAdmin ? user : null;
  } catch (err) {
    console.error("[auth] session lookup failed (denying):", err);
    return null;
  }
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
  const user = await getUser().catch((err) => {
    console.error("[auth] session lookup failed (denying):", err);
    return null;
  });
  if (!user) redirect("/signin");
  if (!user.isAdmin) redirect("/");
  return user;
}
