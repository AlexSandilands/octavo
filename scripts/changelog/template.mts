import { escapeAttr as esc } from "../../src/lib/rich-text.ts";
import {
  COLORS,
  emailHtml,
  plainText,
  type ChangelogEmailInput,
} from "./email.mts";

export type ChangelogTemplateInput = ChangelogEmailInput & {
  subject: string;
  notesPath: string;
  notesDrafted: boolean;
};

function scriptValue(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function notesHint(input: ChangelogTemplateInput): string {
  const path = `<code>${esc(input.notesPath)}</code>`;
  return input.notesDrafted
    ? `The highlights are drafted from pull request titles. Write the client-facing wording in ${path}, then run <code>npm run changelog</code> again.`
    : `Highlights come from ${path}. Edit it and run <code>npm run changelog</code> again, or tweak the wording below before copying.`;
}

export function renderChangelogPage(input: ChangelogTemplateInput): string {
  const email = emailHtml(input);
  const text = plainText(input);
  const mailto = `mailto:?subject=${encodeURIComponent(input.subject)}`;
  const protonUrl = `https://mail.proton.me/inbox/#mailto=${encodeURIComponent(mailto)}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(input.subject)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e9e3d8; color: ${COLORS.ink}; font-family: Arial, Helvetica, sans-serif; }
  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; padding: 14px; background: ${COLORS.card}; border-bottom: 1px solid ${COLORS.line}; box-shadow: 0 5px 18px rgba(32,32,28,.08); }
  button, .button { min-height: 44px; padding: 10px 16px; border: 1px solid ${COLORS.accent}; border-radius: 8px; background: ${COLORS.accent}; color: ${COLORS.paper}; font: bold 15px/1.2 Arial, Helvetica, sans-serif; text-decoration: none; cursor: pointer; }
  .secondary { background: ${COLORS.card}; color: ${COLORS.accent}; }
  button:hover, .button:hover { background: #184034; color: ${COLORS.paper}; }
  button:focus-visible, .button:focus-visible, input:focus-visible, [contenteditable]:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 3px; }
  .toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 6px; font-size: 15px; color: ${COLORS.ink}; cursor: pointer; }
  .toggle input { width: 20px; height: 20px; margin: 0; accent-color: ${COLORS.accent}; }
  .hint { flex-basis: 100%; margin: 0; text-align: center; color: ${COLORS.muted}; font-size: 14px; line-height: 1.4; }
  .notes { max-width: 760px; margin: 22px auto 0; padding: 12px 16px; border-left: 4px solid #9a4f2b; background: ${COLORS.card}; color: ${COLORS.body}; font-size: 14px; line-height: 1.5; }
  .notes code { font-size: 13px; }
  .preview { max-width: 760px; margin: 18px auto 50px; box-shadow: 0 18px 45px rgba(42,39,34,.14); }
  .preview.no-detail #email-detail { display: none; }
  [contenteditable="true"] { border-radius: 2px; }
  @media (max-width: 640px) { .toolbar { justify-content: stretch; } button, .button { flex: 1; text-align: center; } .preview { margin-top: 12px; } }
</style>
</head>
<body>
  <div class="toolbar" role="region" aria-label="Email actions">
    <button id="copy-open" type="button">Copy email &amp; open Proton</button>
    <button id="copy" class="secondary" type="button">Copy formatted email</button>
    <a class="button secondary" href="${esc(protonUrl)}" target="_blank" rel="noreferrer">Open Proton Mail</a>
    <label class="toggle"><input id="detail" type="checkbox" checked /> Include the detailed list</label>
    <p id="status" class="hint" aria-live="polite">You can edit the preview below. Copy it, open Proton, then paste it into the message body.</p>
  </div>
  <p class="notes" role="note">${notesHint(input)}</p>
  <main id="preview" class="preview" contenteditable="true" aria-label="Editable email preview">
    ${email}
  </main>
<script>
  const plainText = ${scriptValue(text)};
  const protonUrl = ${scriptValue(protonUrl)};
  const status = document.querySelector("#status");
  const preview = document.querySelector("#preview");
  const detailToggle = document.querySelector("#detail");
  const copied = "Copied. Paste into the Proton message body with Ctrl+V or Cmd+V.";

  detailToggle.addEventListener("change", () => {
    preview.classList.toggle("no-detail", !detailToggle.checked);
  });

  function emailMarkup() {
    const email = document.querySelector("#email-content").cloneNode(true);
    if (!detailToggle.checked) email.querySelector("#email-detail")?.remove();
    return email.outerHTML;
  }

  function emailText() {
    if (detailToggle.checked) return plainText;
    return plainText.split("\\nEVERY CHANGE IN DETAIL")[0];
  }

  async function copyEmail() {
    const html = emailMarkup();
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([emailText()], { type: "text/plain" })
        })]);
        status.textContent = copied;
        return;
      } catch {}
    }
    const email = document.querySelector("#email-content");
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(email);
    selection.removeAllRanges();
    selection.addRange(range);
    if (!document.execCommand("copy")) throw new Error("Copy was unavailable");
    selection.removeAllRanges();
    status.textContent = copied;
  }

  document.querySelector("#copy").addEventListener("click", async () => {
    try { await copyEmail(); }
    catch { status.textContent = "Automatic copy was blocked. Select the email preview and copy it manually."; }
  });

  document.querySelector("#copy-open").addEventListener("click", async () => {
    const proton = window.open(protonUrl, "_blank", "noopener,noreferrer");
    try { await copyEmail(); }
    catch { status.textContent = "Proton opened, but automatic copy was blocked. Select the preview and copy it manually."; }
    if (!proton) window.location.href = protonUrl;
  });
</script>
</body>
</html>`;
}
