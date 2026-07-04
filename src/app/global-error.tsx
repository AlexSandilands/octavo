"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Top-level boundary for errors thrown in the root layout itself — the one
// place the ordinary route error.tsx can't catch. It replaces the whole
// document, so it must render its own <html>/<body> and cannot rely on the
// app's Tailwind tokens or global CSS being present. Styles are therefore
// inline with the magazine palette spelled out (same pragmatic exception the
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
          background: "#f4f0e8",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#20201c",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            width: "100%",
            background: "#fbf9f4",
            border: "1px solid #e6e0d3",
            borderRadius: "5px",
            padding: "40px",
          }}
        >
          <p style={{ margin: 0, fontStyle: "italic", color: "#1d4d3e" }}>
            Something went wrong
          </p>
          <h1
            style={{ margin: "12px 0 0", fontSize: "34px", lineHeight: 1.05 }}
          >
            We couldn&rsquo;t open the magazine.
          </h1>
          <p
            style={{
              margin: "16px 0 28px",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#56524a",
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
              background: "#1d4d3e",
              color: "#f4f0e8",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              padding: "14px 22px",
              borderRadius: "8px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
