import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE } from "@/lib/demo";
import { safeNextPath } from "@/lib/next-path";

// This middleware does two jobs on every HTML-serving request:
//
//   1. Content-Security-Policy (per request). Body text is stored as structured
//      JSON and rendered through React elements (content v3 — no
//      dangerouslySetInnerHTML, no HTML sanitiser), so stored content can't
//      inject markup in the first place; this CSP is defence in depth. A fresh
//      nonce per request lets `script-src` drop 'unsafe-inline' entirely, so an
//      injected inline <script> or
//      onerror=/onclick= handler will NOT execute — only Next's own
//      nonce-tagged bootstrap runs, and 'strict-dynamic' lets that bootstrap
//      load the app chunks. Next reads the nonce from the request-side CSP
//      header (below) to tag those scripts. This is the real XSS backstop the
//      old comment only claimed to be.
//      Not covered: `style-src` keeps 'unsafe-inline' because the readers set
//      inline styles legitimately (per-block layout), so injected *style*
//      attributes still apply — acceptable, as CSS alone can't run script here
//      with `script-src` locked down. `img-src` allows the R2 origin so served
//      uploads load. Dev keeps 'unsafe-eval' for React Fast Refresh.
//
//   2. Edge auth gate for the members-only routes (`/`, `/read/*`, `/admin/*`).
//      It only checks for the *presence* of a session cookie — it runs on the
//      Edge runtime and can't reach Postgres to validate a database session,
//      so the in-component gates (requireMember / requireAdmin in
//      src/server/session.ts) stay the authority. Its jobs are:
//        - issue the sign-in redirect before any HTML streams, so signed-out
//          visitors never see a flash of the route's loading skeleton (#5),
//        - carry the destination as ?next= so the emailed link returns members
//          to the page they clicked.
//      A present-but-stale cookie passes here and is caught by the server gate.
//
// The matcher now runs on all HTML routes (for the CSP), but the auth gate is
// still scoped to the three gated prefixes via isGatedRoute() below.

const r2 = process.env.R2_PUBLIC_URL;
const isDev = process.env.NODE_ENV === "development";

// Sentry's browser SDK POSTs events straight to its ingest host, so with our
// locked-down CSP (`connect-src` inherits `default-src 'self'`) those requests
// would be blocked unless we allow that one origin. Derive it from the DSN
// (a public value — the client reads the same one from NEXT_PUBLIC_SENTRY_DSN);
// when no DSN is set, connect-src stays 'self' only. Mirrors how img-src opts
// in the R2 origin below.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
const sentryOrigin = (() => {
  if (!sentryDsn) return "";
  try {
    return new URL(sentryDsn).origin;
  } catch {
    return "";
  }
})();

// Auth.js names the cookie differently by transport: dev (HTTP) uses the bare
// name, production (HTTPS) the __Secure- prefix. Check both.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => req.cookies.has(name));
}

// The three members-only prefixes the auth gate covers — unchanged from when
// this lived in the matcher (`/`, `/read/:path*`, `/admin/:path*`). The one
// carve-out is the PDF print route (`/read/[n]/print`): it carries no session
// cookie (the generator self-fetches over localhost) and would be redirected to
// /signin here, so it is let through the edge and guarded instead by the
// internal print token it validates in-route (src/lib/pdf-token.ts) — without a
// valid token it 404s, so it stays unreachable from outside.
//
// Demo mode (issue #50) drops `/` and `/read/*` from the gate so a showcase
// deployment is publicly browsable — `/admin/*` stays gated unconditionally.
// requireMemberOrRedirect honours the same DEMO_MODE flag, so the edge and the
// in-component authority agree.
function isGatedRoute(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (DEMO_MODE) return false;
  if (pathname === "/") return true;
  if (pathname === "/read") return true;
  if (pathname.startsWith("/read/")) return !pathname.endsWith("/print");
  return false;
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Nonce + strict-dynamic replaces 'unsafe-inline': browsers that support
    // strict-dynamic trust only nonce-tagged scripts and what they load.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Kept 'unsafe-inline' deliberately — see the file header (inline block
    // styles in the readers). Script injection is the real risk and is blocked
    // above; inline CSS cannot execute code with script-src locked down.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${r2 ? ` ${new URL(r2).origin}` : ""}`,
    // Same-origin XHR/fetch (server actions, autosave) plus the Sentry ingest
    // host when configured. Explicit 'self' matches what was previously
    // inherited from default-src, so no existing request is affected.
    `connect-src 'self'${sentryOrigin ? ` ${sentryOrigin}` : ""}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Auth gate first: a redirect response renders no HTML, so it needs no CSP —
  // the redirect *target* (/signin) gets its own pass through this middleware.
  if (isGatedRoute(pathname) && !hasSessionCookie(req)) {
    const signin = new URL("/signin", req.url);
    // Member routes carry the return path; /admin mirrors
    // requireAdminOrRedirect, which redirects to a bare /signin. safeNextPath
    // is defence-in-depth — the path is our own request URL, but it strips
    // control chars and rejects the library root (which needs no ?next=).
    if (!pathname.startsWith("/admin")) {
      const next = safeNextPath(pathname + search);
      if (next !== "/") signin.searchParams.set("next", next);
    }
    return NextResponse.redirect(signin, 307);
  }

  // Per-request nonce. Next tags its inline bootstrap scripts by reading the
  // nonce from the request-side CSP header, so it must be set on the *request*
  // (via NextResponse.next({ request })), not only on the response. x-nonce is
  // the convention for any Server Component that needs to read it back.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

// Run on everything except Next's static assets and the favicon: static files
// carry their headers from next.config.ts and need no per-request nonce, and
// excluding them keeps this off the hot asset path. The auth gate stays scoped
// to the gated prefixes in code (isGatedRoute), so broadening the matcher for
// the CSP does not gate any new route.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
