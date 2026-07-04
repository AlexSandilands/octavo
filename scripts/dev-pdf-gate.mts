// Dev-only: verifies the PDF export surface (issue #16) that is checkable
// without a browser binary — HTTP-level only, no Chromium. Covers:
//   - the internal print route's token gate (no/invalid token → 404),
//   - the print route rendering the issue HTML (the exact input Chromium prints)
//     when given the valid token, and 404 for an unpublished/unknown issue,
//   - the download endpoint's members-only gate (signed out → 403 JSON).
// It derives the internal print token the same way the app does, from
// AUTH_SECRET in .env.local. Requires a running dev server and the seed's
// published issue number 3.
//
// What it deliberately does NOT do: launch Chromium or drive the authenticated
// generate→cache→serve path — that needs a real browser (forbidden here) and a
// member session; verify those in the manual pass (see the issue report).
// Run: npx tsx scripts/dev-pdf-gate.mts <base-url>
import { createHash } from "node:crypto";

process.loadEnvFile?.(".env.local");
const [base] = process.argv.slice(2);
if (!base) throw new Error("usage: dev-pdf-gate.mts <base-url>");

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error("AUTH_SECRET missing from .env.local");
const token = createHash("sha256").update(`${secret}:pdf-print`).digest("hex");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const ISSUE = 3; // seed's published issue

// The `.pdf-page` sheet class is the tell that the print document actually
// rendered the issue. `notFound()` returns the standard Next not-found page —
// which carries no issue content — so its absence is what "cannot fetch the
// print route" means here. (Next 15 streams the layout shell before the async
// page runs, so a notFound() page responds 200 with the 404 body rather than a
// 404 status — an app-wide behavior; the guarantee is content-absence, asserted
// below, not the status line.)
const rendered = (html: string) => html.includes("pdf-page");

// 1. Print route without a token serves no issue content.
{
  const res = await fetch(`${base}/read/${ISSUE}/print`, {
    redirect: "manual",
  });
  ok(
    !rendered(await res.text()),
    "no token: print route serves no issue content",
  );
}

// 2. A wrong token is likewise rejected — no content.
{
  const res = await fetch(`${base}/read/${ISSUE}/print?token=wrong`, {
    redirect: "manual",
  });
  ok(
    !rendered(await res.text()),
    "bad token: print route serves no issue content",
  );
}

// 3. The valid token renders the print document — the fixed-canvas HTML Chromium
//    consumes. Assert the page-break scaffolding, the @page canvas size and real
//    themed content are all present (proves BlockView/PageFrame rendered).
{
  const res = await fetch(`${base}/read/${ISSUE}/print?token=${token}`, {
    redirect: "manual",
  });
  ok(res.status === 200, `valid token: print route → 200 (got ${res.status})`);
  const html = await res.text();
  ok(
    rendered(html),
    "valid token: print HTML carries per-page sheets (.pdf-page)",
  );
  ok(
    html.includes("@page"),
    "valid token: print HTML sets the @page canvas size",
  );
  ok(
    /No\.\s*3|font-newsreader|font-serif/.test(html),
    "valid token: print HTML rendered issue chrome/fonts (not an empty page)",
  );
}

// 4. The theme param reaches the renderer (the PDF cache keys each theme as its
//    own artifact). Classic page chrome carries the double `border-page-frame`
//    rules; Modern replaces them with the accent spine — so the marker's
//    presence/absence tells the themes apart without diffing whole documents
//    (which always differ via the per-request CSP nonce).
{
  const classic = await fetch(`${base}/read/${ISSUE}/print?token=${token}`);
  const modern = await fetch(
    `${base}/read/${ISSUE}/print?token=${token}&theme=modern`,
  );
  const [classicHtml, modernHtml] = await Promise.all([
    classic.text(),
    modern.text(),
  ]);
  ok(
    classicHtml.includes("border-page-frame"),
    "default theme: print renders classic page chrome",
  );
  ok(rendered(modernHtml), "theme=modern: print route renders");
  ok(
    !modernHtml.includes("border-page-frame"),
    "theme=modern: print drops the classic page chrome",
  );
}

// 5. An unpublished / unknown issue serves no content even with a valid token.
{
  const res = await fetch(`${base}/read/999999/print?token=${token}`, {
    redirect: "manual",
  });
  ok(
    !rendered(await res.text()),
    "unknown issue: print route serves no content",
  );
}

// 6. The download endpoint is members-only: a signed-out request is refused with
//    a 403 JSON body — a legible error, never a redirect or a hung generation.
{
  const res = await fetch(`${base}/api/issues/${ISSUE}/pdf`, {
    redirect: "manual",
  });
  ok(res.status === 403, `signed-out PDF download → 403 (got ${res.status})`);
  const body = (await res.json()) as { error?: string };
  ok(typeof body.error === "string", "403 carries a JSON error message");
}

console.log("\nall checks passed");
