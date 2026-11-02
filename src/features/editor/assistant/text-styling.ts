import type { CoverColor } from "@/lib/cover-appearance";
import type { CoverFont } from "@/lib/cover-fonts";
import type {
  RichBlock,
  RichDoc,
  RichInline,
  RichMark,
  RichTextNode,
} from "@/lib/rich-text-doc";
import { cleanPaint, type TextPaint } from "@/lib/text-paint";

// Colour and typeface on body-text words for the assistant (content v11). The
// model reads and writes markdown, which carries neither, so: `paintRuns` lists
// the styled words for read_page, `styleWords` is style_text, and `carryPaint`
// keeps set_text from wiping styling on words it left alone.

/** A tool's colour/font choice: a value, "theme" to clear it, absent to keep. */
export type PaintChoice = {
  color?: CoverColor | "theme";
  font?: CoverFont | "theme";
};

export function choosePaint(
  old: TextPaint | undefined,
  choice: PaintChoice,
): TextPaint | undefined {
  const pick = <T>(v: T | "theme" | undefined, was: T | undefined) =>
    v === "theme" ? undefined : (v ?? was);
  return cleanPaint({
    color: pick(choice.color, old?.color),
    font: pick(choice.font, old?.font),
  });
}

const paintOf = (n: RichTextNode) =>
  n.marks?.find((m) => m.type === "paint")?.attrs as TextPaint | undefined;
const samePaint = (a?: TextPaint, b?: TextPaint) =>
  a?.color === b?.color && a?.font === b?.font;

/** Every paragraph's inline list, in reading order (list items included). */
function paragraphs(blocks: RichBlock[], out: RichInline[][] = []) {
  for (const b of blocks) {
    if (b.type === "paragraph") out.push((b.content ??= []));
    else for (const li of b.content) paragraphs(li.content, out);
  }
  return out;
}

const plainOf = (inline: RichInline[]) =>
  inline.map((n) => (n.type === "text" ? n.text : "\n")).join("");

/** "how it reads" for a run's paint, in the tools' own words. */
export function describePaint(p: TextPaint): string {
  return [p.color && `color ${p.color}`, p.font && `font ${p.font}`]
    .filter(Boolean)
    .join(", ");
}

/** The styled stretches of a doc: neighbouring runs with one paint join up. */
export function paintRuns(doc: RichDoc): { text: string; paint: TextPaint }[] {
  const runs: { text: string; paint: TextPaint }[] = [];
  for (const inline of paragraphs(structuredClone(doc).content)) {
    let open: { text: string; paint: TextPaint } | null = null;
    for (const n of inline) {
      const paint = n.type === "text" ? paintOf(n) : undefined;
      if (n.type === "text" && paint && open && samePaint(open.paint, paint)) {
        open.text += n.text;
      } else {
        open = n.type === "text" && paint ? { text: n.text, paint } : null;
        if (open) runs.push(open);
      }
    }
  }
  return runs;
}

/** Split one paragraph's runs so [start, end) is whole runs, then restyle those. */
function restyleRange(
  inline: RichInline[],
  start: number,
  end: number,
  apply: (old?: TextPaint) => TextPaint | undefined,
): RichInline[] {
  const out: RichInline[] = [];
  let at = 0;
  for (const n of inline) {
    const len = n.type === "text" ? n.text.length : 1;
    const [from, to] = [at, at + len];
    at = to;
    if (n.type !== "text" || to <= start || from >= end) {
      out.push(n);
      continue;
    }
    const cut = [Math.max(start, from) - from, Math.min(end, to) - from];
    const piece = (text: string, marks?: RichMark[]) =>
      text &&
      out.push(marks?.length ? { ...n, text, marks } : { type: "text", text });
    piece(n.text.slice(0, cut[0]), n.marks);
    const paint = apply(paintOf(n));
    const others = (n.marks ?? []).filter((m) => m.type !== "paint");
    piece(
      n.text.slice(cut[0], cut[1]),
      paint ? [...others, { type: "paint", attrs: paint }] : others,
    );
    piece(n.text.slice(cut[1]), n.marks);
  }
  return merge(out);
}

/** Neighbouring text runs with the same marks become one again. */
function merge(inline: RichInline[]): RichInline[] {
  const out: RichInline[] = [];
  for (const n of inline) {
    const last = out[out.length - 1];
    if (
      n.type === "text" &&
      last?.type === "text" &&
      JSON.stringify(last.marks ?? []) === JSON.stringify(n.marks ?? [])
    )
      out[out.length - 1] = { ...last, text: last.text + n.text };
    else out.push(n);
  }
  return out;
}

const WORD = /[\p{L}\p{N}]/u;
/** Whether hay[start, start+len) begins and ends on word edges, so "art"
 *  never matches inside "Start". Edges the phrase itself doesn't sit on
 *  (it starts or ends with a space or a mark) need no check. */
function onWordEdges(hay: string, start: number, len: number) {
  const end = start + len;
  const cut = (inside: string | undefined, outside: string | undefined) =>
    !!inside && !!outside && WORD.test(inside) && WORD.test(outside);
  return !cut(hay[start], hay[start - 1]) && !cut(hay[end - 1], hay[end]);
}

/** Each place `phrase` occurs, paragraph by paragraph; whole words unless
 *  `inWords` (a stretch the author styled mid-word). */
function occurrences(
  paras: RichInline[][],
  phrase: string,
  { fold = false, inWords = false } = {},
) {
  const hits: { para: number; start: number }[] = [];
  const needle = fold ? phrase.toLowerCase() : phrase;
  paras.forEach((inline, para) => {
    const hay = fold ? plainOf(inline).toLowerCase() : plainOf(inline);
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1))
      if (inWords || onWordEdges(hay, i, needle.length))
        hits.push({ para, start: i });
  });
  return hits;
}

/** How alike two places read: shared characters just before and just after. */
function contextScore(
  a: string,
  aAt: number,
  b: string,
  bAt: number,
  len: number,
) {
  let score = 0;
  for (
    let k = 1;
    k <= 40 && a[aAt - k] !== undefined && a[aAt - k] === b[bAt - k];
    k++
  )
    score++;
  for (
    let k = 0;
    k < 40 &&
    a[aAt + len + k] !== undefined &&
    a[aAt + len + k] === b[bAt + len + k];
    k++
  )
    score++;
  return score;
}

/** style_text: restyle every occurrence of `match`, or the whole doc. */
export function styleWords(
  doc: RichDoc,
  match: string | undefined,
  choice: PaintChoice,
): { doc: RichDoc; count: number } {
  const next = structuredClone(doc);
  const paras = paragraphs(next.content);
  const apply = (old?: TextPaint) => choosePaint(old, choice);
  const replace = (i: number, inline: RichInline[]) =>
    paras[i]!.splice(0, paras[i]!.length, ...inline);
  if (match === undefined) {
    paras.forEach((p, i) =>
      replace(i, restyleRange(p, 0, plainOf(p).length, apply)),
    );
    return { doc: next, count: paras.length ? 1 : 0 };
  }
  let hits = occurrences(paras, match);
  if (!hits.length) hits = occurrences(paras, match, { fold: true });
  for (const { para, start } of hits)
    replace(
      para,
      restyleRange(paras[para]!, start, start + match.length, apply),
    );
  return { doc: next, count: hits.length };
}

/**
 * set_text: put the old doc's colour/font back on words the new one kept. Each
 * styled stretch is found again by its words: of the places they occur in the
 * new text, the one whose neighbouring words match the old place best, then
 * the one nearest its old order. A stretch whose words are gone is reported,
 * so the model can restyle on purpose.
 */
export function carryPaint(
  old: RichDoc,
  next: RichDoc,
): { doc: RichDoc; dropped: string[] } {
  const oldParas = paragraphs(structuredClone(old).content);
  const doc = structuredClone(next);
  const paras = paragraphs(doc.content);
  const dropped: string[] = [];
  oldParas.forEach((inline, para) => {
    let at = 0;
    let run: { start: number; text: string; paint: TextPaint } | null = null;
    const close = () => {
      if (!run) return;
      const oldHay = plainOf(oldParas[para]!);
      const inWords = !onWordEdges(oldHay, run.start, run.text.length);
      const nth = occurrences(oldParas, run.text, { inWords }).filter(
        (h) => h.para < para || (h.para === para && h.start < run!.start),
      ).length;
      const candidates = occurrences(paras, run.text, { inWords });
      const score = (h: { para: number; start: number }) =>
        contextScore(
          oldHay,
          run!.start,
          plainOf(paras[h.para]!),
          h.start,
          run!.text.length,
        );
      const hit = candidates
        .map((h, i) => ({ h, s: score(h), d: Math.abs(i - nth) }))
        .sort((a, b) => b.s - a.s || a.d - b.d)[0]?.h;
      const paint = run.paint;
      if (hit)
        paras[hit.para]!.splice(
          0,
          paras[hit.para]!.length,
          ...restyleRange(
            paras[hit.para]!,
            hit.start,
            hit.start + run.text.length,
            (was) => cleanPaint({ ...was, ...paint }),
          ),
        );
      else dropped.push(run.text);
      run = null;
    };
    for (const n of inline) {
      const paint = n.type === "text" ? paintOf(n) : undefined;
      if (n.type === "text" && paint && run && samePaint(run.paint, paint))
        run.text += n.text;
      else {
        close();
        if (n.type === "text" && paint)
          run = { start: at, text: n.text, paint };
      }
      at += n.type === "text" ? n.text.length : 1;
    }
    close();
  });
  return { doc, dropped };
}
