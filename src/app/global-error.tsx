"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Top-level boundary for errors thrown in the root layout itself — the one
// place the ordinary route error.tsx can't catch. It replaces the whole
// document, so it must render its own <html>/<body> and cannot rely on the
// app's Tailwind tokens or global CSS being present. Styles are therefore
// inline with the app palette spelled out (same pragmatic exception the
// email templates make), and there is no <Link>/router dependency — a full
// reload is the only safe recovery when the layout itself failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error", error.digest ?? error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 20px",
          background: "#f5f6f8",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          color: "#16192b",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            width: "100%",
            background: "#ffffff",
            border: "1px solid #dfe2ea",
            borderRadius: "16px",
            padding: "40px",
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: "#c0262d" }}>
            Something went wrong
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: "32px", lineHeight: 1.1 }}>
            We couldn&rsquo;t open the magazine.
          </h1>
          <p
            style={{
              margin: "16px 0 28px",
              fontSize: "17px",
              lineHeight: 1.6,
              color: "#4d5468",
            }}
          >
            It&rsquo;s not you &mdash; something on our side didn&rsquo;t
            respond. Give it another try; it usually rights itself in a few
            minutes.
          </p>
          <button
            onClick={() => reset()}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              background: "#2447c6",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 700,
              padding: "14px 24px",
              borderRadius: "999px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
