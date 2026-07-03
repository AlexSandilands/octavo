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
