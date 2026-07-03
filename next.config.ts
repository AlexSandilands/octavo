import type { NextConfig } from "next";

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
};

export default nextConfig;
