import { escapeAttr as esc } from "../../src/lib/rich-text.ts";
import type { ChangelogItem, ChangeKind } from "./git.mts";
import type { NotesSection } from "./notes.mts";

export type ChangelogEmailInput = {
  product: string;
  title: string;
  from: string;
  to: string;
  date: Date;
  sinceDate: Date;
  changes: ChangelogItem[];
  sections: NotesSection[];
  compareUrl: string | null;
};

export const COLORS = {
  paper: "#f4f0e8",
  card: "#fbf9f4",
  tint: "#e8efe9",
  accent: "#1d4d3e",
  accentInk: "#143a2e",
  ink: "#20201c",
  body: "#2a2722",
  muted: "#56524a",
  faint: "#615c50",
  line: "#e6e0d3",
  rule: "#cfc6b4",
};

/** Marker colours per highlight section, in order; all hold white text at AA. */
const MARKERS = ["#1d4d3e", "#9a4f2b", "#3f4f6b"];

const SANS = "Arial,Helvetica,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const KINDS: ChangeKind[] = ["feature", "improvement", "internal"];

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function kindLabel(kind: ChangeKind): string {
  if (kind === "feature") return "New features";
  if (kind === "improvement") return "Fixes and improvements";
  return "Behind the scenes";
}

/** Escapes text, then honours **bold** spans from the notes file. */
function inline(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function eyebrow(text: string, color = COLORS.accent): string {
  return `<div style="font-family:${SANS};font-size:11px;font-weight:bold;line-height:1.4;letter-spacing:.17em;text-transform:uppercase;color:${color};">${text}</div>`;
}

function statTile(value: string, label: string): string {
  return `<td width="33%" valign="top" style="padding:16px 14px;background:${COLORS.tint};border-radius:10px;">
    <div style="font-family:${SANS};font-size:30px;font-weight:bold;line-height:1;color:${COLORS.accentInk};">${esc(value)}</div>
    <div style="margin-top:7px;font-family:${SANS};font-size:13px;line-height:1.35;color:${COLORS.muted};">${esc(label)}</div>
  </td>`;
}

function statsHtml(input: ChangelogEmailInput): string {
  const count = (kind: ChangeKind) =>
    input.changes.filter((change) => change.kind === kind).length;
  const days = Math.max(
    1,
    Math.round((input.date.getTime() - input.sinceDate.getTime()) / 86_400_000),
  );
  const tiles = [
    count("feature") ? statTile(String(count("feature")), "New features") : "",
    count("improvement")
      ? statTile(String(count("improvement")), "Fixes and improvements")
      : "",
    statTile(`${days} ${days === 1 ? "day" : "days"}`, "Since the last update"),
  ].filter(Boolean);
  const gap = `<td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>`;
  return `<tr>
    <td style="padding:0 34px 30px 34px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
        <tr>${tiles.join(gap)}</tr>
      </table>
    </td>
  </tr>`;
}

function highlightHtml(
  section: NotesSection,
  index: number,
  color: string,
  last: boolean,
): string {
  const highlight = section.highlights[index]!;
  const paragraphs = highlight.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:6px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.body};">${inline(paragraph)}</p>`,
    )
    .join("\n");
  return `<tr>
    <td width="34" valign="top" style="padding:${index ? 18 : 0}px 0 ${last ? 0 : 18}px 0;">
      <div style="width:26px;height:26px;border-radius:13px;background:${color};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:bold;line-height:26px;text-align:center;">${index + 1}</div>
    </td>
    <td valign="top" style="padding:${index ? 18 : 0}px 0 ${last ? 0 : 18}px 4px;${last ? "" : `border-bottom:1px solid ${COLORS.line};`}">
      <div style="font-family:${SANS};font-size:17px;font-weight:bold;line-height:1.35;color:${COLORS.ink};">${inline(highlight.headline)}</div>
      ${paragraphs}
    </td>
  </tr>`;
}

function highlightSectionHtml(section: NotesSection, order: number): string {
  const color = MARKERS[order % MARKERS.length]!;
  const rows = section.highlights.map((_, index) =>
    highlightHtml(
      section,
      index,
      color,
      index === section.highlights.length - 1,
    ),
  );
  return `<tr>
    <td style="padding:0 34px 34px 34px;">
      <div style="width:36px;height:3px;background:${color};"></div>
      <h2 style="margin:12px 0 18px 0;font-family:${SERIF};font-size:23px;font-weight:normal;line-height:1.2;color:${COLORS.ink};">${esc(section.title)}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join("\n")}
      </table>
    </td>
  </tr>`;
}

function detailRowHtml(item: ChangelogItem): string {
  const cell = `valign="top" style="padding:9px 0 0 0;border-top:1px solid ${COLORS.line};font-family:${SANS};line-height:1.5;`;
  const title = item.url
    ? `<a href="${esc(item.url)}" style="color:${COLORS.ink};text-decoration:none;">${esc(item.title)}</a>`
    : esc(item.title);
  const reference = item.pullRequest
    ? `<td align="right" ${cell}padding-left:12px;white-space:nowrap;font-size:12px;color:${COLORS.faint};">#${item.pullRequest}</td>`
    : "";
  const commits = item.commits
    .map(
      (line) =>
        `<div style="margin-top:3px;font-size:13px;font-weight:normal;color:${COLORS.muted};">&ndash;&nbsp; ${esc(line)}</div>`,
    )
    .join("\n");
  return `<tr>
    <td ${cell}font-size:14px;font-weight:bold;color:${COLORS.ink};">
      ${title}
      ${commits}
    </td>
    ${reference}
  </tr>`;
}

function detailHtml(input: ChangelogEmailInput): string {
  const groups = KINDS.map((kind) => {
    const items = input.changes.filter((change) => change.kind === kind);
    if (!items.length) return "";
    return `<div style="margin:22px 0 4px 0;">${eyebrow(esc(kindLabel(kind)), COLORS.faint)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        ${items.map(detailRowHtml).join("\n")}
      </table>`;
  }).join("\n");
  return `<tr id="email-detail">
    <td style="padding:0 34px 30px 34px;">
      <div style="padding:22px 24px 26px 24px;background:${COLORS.paper};border-radius:12px;">
        ${eyebrow("For the curious")}
        <h2 style="margin:8px 0 6px 0;font-family:${SERIF};font-size:20px;font-weight:normal;line-height:1.2;color:${COLORS.ink};">Every change in detail</h2>
        <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.55;color:${COLORS.muted};">The full list behind the highlights above, one entry per change, with the smaller steps inside each.</p>
        ${groups}
      </div>
    </td>
  </tr>`;
}

export function emailHtml(input: ChangelogEmailInput): string {
  const sections = input.sections
    .map((section, order) => highlightSectionHtml(section, order))
    .join("\n");
  const compare = input.compareUrl
    ? `<a href="${esc(input.compareUrl)}" style="color:${COLORS.accent};text-decoration:underline;">the full code history on GitHub</a>`
    : `the code history from ${esc(input.from)} to ${esc(input.to)}`;

  return `<table id="email-content" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0;background:${COLORS.paper};border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${COLORS.card};border:1px solid ${COLORS.line};border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:33px 34px 26px 34px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:${SERIF};font-size:24px;line-height:1.1;color:${COLORS.ink};">${esc(input.product)}</td>
                <td align="right">${eyebrow("Product update", COLORS.faint)}</td>
              </tr>
            </table>
            <div style="margin-top:27px;">${eyebrow(esc(formatDate(input.date)))}</div>
            <h1 style="margin:7px 0 0 0;font-family:${SERIF};font-size:34px;font-weight:normal;line-height:1.12;color:${COLORS.ink};">${esc(input.title)}</h1>
            <p style="margin:17px 0 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${COLORS.body};">Here&rsquo;s what has changed in ${esc(input.product)} since the last update on ${esc(formatDate(input.sinceDate))}. The highlights come first; the full list of changes is at the end for anyone who wants it.</p>
          </td>
        </tr>
        ${statsHtml(input)}
        ${sections}
        ${detailHtml(input)}
        <tr>
          <td style="padding:0 34px 31px 34px;">
            <p style="margin:0;padding-top:18px;border-top:1px solid ${COLORS.line};font-family:${SANS};font-size:13px;line-height:1.55;color:${COLORS.muted};">Questions, or something not behaving as described? Just reply to this email. Developers can browse ${compare}.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function plainText(input: ChangelogEmailInput): string {
  const lines = [input.product, input.title, formatDate(input.date), ""];
  for (const section of input.sections) {
    lines.push(section.title.toUpperCase(), "");
    for (const highlight of section.highlights) {
      lines.push(`- ${highlight.headline}`);
      for (const paragraph of highlight.paragraphs)
        lines.push(`  ${paragraph}`);
      lines.push("");
    }
  }
  lines.push("EVERY CHANGE IN DETAIL");
  for (const kind of KINDS) {
    const items = input.changes.filter((change) => change.kind === kind);
    if (!items.length) continue;
    lines.push("", kindLabel(kind));
    for (const item of items) {
      lines.push(
        `- ${item.title}${item.pullRequest ? ` (#${item.pullRequest})` : ""}`,
      );
      for (const commit of item.commits) lines.push(`    - ${commit}`);
    }
  }
  if (input.compareUrl) lines.push("", input.compareUrl);
  return lines.join("\n");
}
