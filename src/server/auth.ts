import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import ResendProvider from "next-auth/providers/resend";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";
import { authAdapter } from "./auth-adapter";
import { sendMagicLinkEmail } from "./auth-email";

// Auth.js v5: magic-link email sign-in with database sessions.
//
// Membership IS the users table — a sign-in link is only ever sent to an
// email that already has a row (the admin adds members; nobody self-signs-up).
// The signIn callback enforces that before Auth.js creates a verification
// token, so an unknown email leaves nothing behind in the database.

// Long-lived sessions: the audience is older and non-technical, and making
// them re-request a link every week would lose readers.
const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // ~90 days

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    isAdmin: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: authAdapter,
  session: { strategy: "database", maxAge: SESSION_MAX_AGE },
  secret: env.AUTH_SECRET,
  // Railway sits behind a TLS-terminating proxy; the Host header is what the
  // platform routed, so callback URLs can be built from it.
  trustHost: true,
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/sent",
    // Auth.js appends ?error=Verification (expired/used link) etc.; the
    // sign-in page turns that into a "request a fresh link" message.
    error: "/signin",
  },
  providers: [
    ResendProvider({
      apiKey: env.EMAIL_API_KEY,
      from: env.EMAIL_FROM,
      sendVerificationRequest: sendMagicLinkEmail,
    }),
  ],
  callbacks: {
    // Runs both when a link is requested and when it is clicked. Only emails
    // already on the member list may proceed — returning false here stops
    // Auth.js before it writes a token (on request) or creates a user (on
    // callback). The identifier arrives lowercased (provider normalization),
    // so compare case-insensitively.
    async signIn({ user }) {
      if (!user.email) return false;
      const [member] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${user.email.toLowerCase()}`)
        .limit(1);
      return Boolean(member);
    },
    // Database sessions: `user` is the full users row via the adapter.
    // Expose what route gating needs so later code never re-queries.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isAdmin = user.isAdmin;
      return session;
    },
  },
});
