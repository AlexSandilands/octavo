// Demo mode — an env-flagged switch that ungates the member-facing routes
// (`/`, `/read/*`) so a public showcase deployment works without sign-in,
// while `/admin/*`, every server action and the upload route stay locked
// (issue #50). Off by default; a demo deploy sets NEXT_PUBLIC_DEMO_MODE=1.
//
// NEXT_PUBLIC_* is inlined at *build* time, which is exactly why it's used
// here: the same constant resolves identically in the Edge middleware and in
// server components, so the two gate layers (src/middleware.ts and
// src/server/session.ts) cannot disagree at runtime. On Railway the variable
// must therefore be present when the image builds, not just when it runs.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
