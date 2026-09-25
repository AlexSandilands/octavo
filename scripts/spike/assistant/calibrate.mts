// Calibrates fill.ts's glyph width against real rendering: every seed text
// block and heading set in Newsreader at the page's column width in headless
// Chromium, measured, and compared with the estimate. No app or DB needed.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/calibrate.mts
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { textSizePx } from "../../../src/lib/blocks.ts";
import { blockHeight, textDoc } from "./fill.ts";
import { docToMarkdown } from "./markdown.ts";
import { seedIssues } from "./seed.ts";

const font = readFileSync("src/app/fonts/newsreader-roman.woff2").toString(
  "base64",
);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

type Sample = { html: string; estimate: number; label: string };
const samples: Sample[] = [];
for (const issue of seedIssues())
  for (const page of issue.content.pages) {
    if (page.cover) continue;
    for (const block of page.blocks) {
      if (block.type === "text") {
        const px = textSizePx(block.size);
        // Render the doc as the reader does: p / ul / ol with .rich-text margins.
        const html = docToMarkdown(textDoc(block))
          .split(/\n\n/)
          .map((p) =>
            /^(- |\d+\. )/.test(p)
              ? `<ul>${p
                  .split("\n")
                  .map(
                    (l) => `<li>${esc(l.replace(/^\s*(- |\d+\. )/, ""))}</li>`,
                  )
                  .join("")}</ul>`
              : `<p>${esc(p).replace(/\n/g, "<br>")}</p>`,
          )
          .join("");
        samples.push({
          html: `<div class="rt" style="font-size:${px}px;line-height:1.62">${html}</div>`,
          estimate: blockHeight(block, new Map()),
          label: `text ${block.size ?? "m"}`,
        });
      } else if (block.type === "heading") {
        const level = block.level ?? "main";
        const size = { main: 32, section: 24, paragraph: 15 }[level];
        const lh = { main: 1.25, section: 1.25, paragraph: 1.375 }[level];
        const kicker = block.kicker
          ? `<div style="font-size:13px;line-height:22px">${esc(block.kicker)}</div>`
          : "";
        const pad = {
          main: "padding-bottom:22px;padding-top:6px",
          section: "padding-top:14px",
          paragraph: "",
        }[level];
        samples.push({
          html: `<div style="${pad}">${kicker}<div style="font-size:${size}px;line-height:${lh}">${esc(block.title)}</div></div>`,
          estimate: blockHeight(block, new Map()),
          label: `heading ${level}`,
        });
      }
    }
  }

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<style>
@font-face { font-family: N; src: url(data:font/woff2;base64,${font}); }
body { margin: 0; font-family: N; } .s { width: 560px; display: flow-root; }
.rt p { margin: 0 0 0.55em } .rt > :last-child { margin-bottom: 0 }
.rt ul { margin: 0 0 0.55em; padding-left: 1.5em } .rt li { margin: 0.12em 0 }
</style>${samples.map((s) => `<div class="s">${s.html}</div>`).join("")}`);
await page.evaluate(() => document.fonts.ready);
const real = await page.$$eval(".s", (els) =>
  els.map((e) => (e as HTMLElement).offsetHeight),
);
await browser.close();

const byLabel = new Map<
  string,
  { real: number; est: number; n: number; worst: number }
>();
samples.forEach((s, i) => {
  const r = byLabel.get(s.label) ?? { real: 0, est: 0, n: 0, worst: 0 };
  r.real += real[i]!;
  r.est += s.estimate;
  r.n++;
  r.worst = Math.max(
    r.worst,
    Math.abs(s.estimate - real[i]!) / Math.max(real[i]!, 1),
  );
  byLabel.set(s.label, r);
});
console.log(
  "kind            n   real px   estimate px   est/real   worst block error",
);
for (const [label, r] of [...byLabel].sort())
  console.log(
    `${label.padEnd(15)} ${String(r.n).padStart(2)} ${String(Math.round(r.real)).padStart(9)} ${String(Math.round(r.est)).padStart(13)} ${(r.est / r.real).toFixed(2).padStart(10)} ${(r.worst * 100).toFixed(0).padStart(10)}%`,
  );
