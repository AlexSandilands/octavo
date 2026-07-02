import type { NextConfig } from "next";

const r2 = process.env.R2_PUBLIC_URL;
const isDev = process.env.NODE_ENV === "development";

// Defence-in-depth for stored content: the readers render sanitised rich text,
// and this CSP is the backstop if that sanitiser is ever bypassed. Next.js
// needs inline scripts to boot (and eval in dev); everything else is locked to
// same-origin. frame-ancestors 'none' blocks clickjacking of the admin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${r2 ? ` ${new URL(r2).origin}` : ""}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
