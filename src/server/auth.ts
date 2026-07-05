import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import ResendProvider from "next-auth/providers/resend";
import { env } from "@/lib/env";
import { authAdapter, findUserByEmail } from "./auth-adapter";
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
      // Narrowed from DefaultSession's optional: the users row requires it.
      email: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    isAdmin: boolean;
  }
}

// Lazy config (Auth.js "advanced initialization"): the config function runs
// per request rather than at import, so env.AUTH_SECRET / EMAIL_* are read at
// runtime. `next build` evaluates this module while collecting page data for
// the auth route; eager access would force those secrets to be build args
// (issue #67). The runtime fail-fast is unchanged — the first request still
// throws a clear error if a secret is missing.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
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
    // callback).
    async signIn({ user }) {
      if (!user.email) return false;
      return Boolean(await findUserByEmail(user.email));
    },
    // Database sessions: `user` is the full users row via the adapter. Build
    // the exposed session explicitly — returning the incoming object would
    // serve the raw sessions row (including the bearer sessionToken, which
    // must never leave the httpOnly cookie) at /api/auth/session.
    session({ session, user }) {
      return {
        expires: session.expires,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        },
      };
    },
  },
}));
