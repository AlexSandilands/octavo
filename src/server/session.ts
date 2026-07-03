import "server-only";
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
// or the session lookup itself erroring all come back null.
export async function getAdminUser() {
  try {
    const user = await getUser();
    return user?.isAdmin ? user : null;
  } catch {
    return null;
  }
}

// The gate for server actions and route handlers: call it before touching
// anything. Throwing (rather than returning) means a forgotten check on the
// result can't fail open. Pages preferring a redirect use getAdminUser().
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("Admin session required");
  return user;
}
