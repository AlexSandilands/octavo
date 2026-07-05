import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const r2 = process.env.R2_PUBLIC_URL;

// Static security headers that are identical on every response. These blanket
// *all* routes including static assets (nosniff matters on `/_next/static`).
// The Content-Security-Policy lives in `src/middleware.ts` instead: it carries
// a per-request nonce, so it cannot be a constant here. X-Frame-Options here
// and `frame-ancestors 'none'` in the middleware CSP are deliberate redundancy
// against clickjacking.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2
      ? [{ protocol: "https", hostname: new URL(r2).hostname }]
      : [],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Serve the brand-aware runtime mark at the site root. Next injects
  // `<link rel="icon" href="/icon?…">` from `src/app/icon.tsx`, which stops
  // browsers from *auto*-requesting `/favicon.ico` — but bookmarks, link
  // unfurlers and some first-paint paths still hit `/favicon.ico` directly.
  // Rewriting it to `/icon` answers those with the same PNG mark (200, not
  // 404) without shipping a separate static file. The middleware matcher
  // excludes `favicon.ico`, so this stays off the nonce/CSP path. See #71/#56.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
};

// withSentryConfig wires the build-time pieces of @sentry/nextjs: it registers
// the instrumentation hooks and (when a SENTRY_AUTH_TOKEN + org/project are set)
// uploads source maps so stack traces de-minify. None of that is required at
// runtime — with no auth token it simply skips the upload with a warning, so
// the build stays green without a Sentry account. We deliberately do NOT enable
// the tunnelRoute: client events go straight to the ingest host, which the CSP
// in src/middleware.ts allows via connect-src. `silent` quiets the plugin's
// build logs; telemetry to Sentry about the plugin itself is turned off.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
});
