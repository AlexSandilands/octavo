"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Top-level boundary for errors thrown in the root layout itself — the one
// place the ordinary route error.tsx can't catch. It replaces the whole
// document, so it must render its own <html>/<body> and cannot rely on the
// app's Tailwind tokens or global CSS being present. Styles are therefore
// inline with the Broadsheet UI palette spelled out (sheet #ffffff, lead
// #141414, grey #444441, red #8a1c2b, hairline-strong #85827a — keep in step
// with globals.css), and there is no <Link>/router dependency — a full reload
// is the only safe recovery when the layout itself failed.
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
          background: "#ffffff",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#141414",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            width: "100%",
            background: "#ffffff",
            border: "1px solid #141414",
            borderLeft: "4px solid #8a1c2b",
            padding: "40px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#8a1c2b",
            }}
          >
            Something went wrong
          </p>
          <h1
            style={{ margin: "12px 0 0", fontSize: "36px", lineHeight: 1.05 }}
          >
            We couldn&rsquo;t open the magazine.
          </h1>
          <p
            style={{
              margin: "16px 0 28px",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "17px",
              lineHeight: 1.55,
              color: "#444441",
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
              border: "1px solid #8a1c2b",
              cursor: "pointer",
              background: "#8a1c2b",
              color: "#ffffff",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "16px",
              fontWeight: 600,
              padding: "14px 22px",
              borderRadius: "2px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
