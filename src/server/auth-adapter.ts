import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Adapter } from "next-auth/adapters";
import { db } from "@/db";
import { sessions, users, verificationTokens } from "@/db/schema";

// Hand-rolled Auth.js adapter over the existing users/sessions/
// verification_tokens tables. @auth/drizzle-adapter's types don't line up
// with drizzle-orm 1.0 (and it insists on the full OAuth schema — an
// accounts table and users.image column this magic-link-only app would never
// use), so the ~10 queries the email + database-session flow needs live here
// instead, typed directly against next-auth's Adapter interface.

// The one case-insensitive member lookup — the signIn callback's membership
// gate uses it too, so "who can request a link" can never drift from "who the
// adapter resolves".
export async function findUserByEmail(email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

export const authAdapter: Adapter = {
  // In practice never called: the signIn callback only lets existing members
  // through, and members already have a row. Required by Auth.js regardless.
  async createUser(user) {
    const [row] = await db
      .insert(users)
      .values({
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create user");
    return row;
  },

  async getUser(id) {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ?? null;
  },

  getUserByEmail: findUserByEmail,

  // No OAuth providers — nothing is ever linked to an external account.
  async getUserByAccount() {
    return null;
  },
  async linkAccount() {
    throw new Error("OAuth is not supported — this app is magic-link only");
  },

  async updateUser(user) {
    const [row] = await db
      .update(users)
      .set({
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .where(eq(users.id, user.id))
      .returning();
    if (!row) throw new Error(`No user with id ${user.id}`);
    return row;
  },

  async createSession(session) {
    const [row] = await db.insert(sessions).values(session).returning();
    if (!row) throw new Error("Failed to create session");
    return row;
  },

  async getSessionAndUser(sessionToken) {
    const [row] = await db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);
    return row ?? null;
  },

  async updateSession(session) {
    const [row] = await db
      .update(sessions)
      .set(session)
      .where(eq(sessions.sessionToken, session.sessionToken))
      .returning();
    return row ?? null;
  },

  async deleteSession(sessionToken) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
  },

  async createVerificationToken(token) {
    const [row] = await db.insert(verificationTokens).values(token).returning();
    return row ?? null;
  },

  // Single-use: the row is deleted as it is read, so a second click on the
  // same link finds nothing and Auth.js reports the link as expired.
  async useVerificationToken({ identifier, token }) {
    const [row] = await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, token),
        ),
      )
      .returning();
    return row ?? null;
  },
};
