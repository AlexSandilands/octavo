import { Fragment, type ReactNode } from "react";

// The assistant's reply as the author reads it (#309): plain paragraphs, with
// markdown's bulleted and numbered lists and **bold** — nothing else, and never
// HTML. Everything is a React text node, so nothing in a reply is markup.

type Chunk =
  | { kind: "p"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

function chunks(text: string): Chunk[] {
  const out: Chunk[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const last = out[out.length - 1];
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1]!;
      if (last?.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else if (!line.trim()) {
      out.push({ kind: "p", lines: [] });
    } else if (last?.kind === "p") {
      last.lines.push(line.trim());
    } else {
      out.push({ kind: "p", lines: [line.trim()] });
    }
  }
  return out.filter((c) => (c.kind === "p" ? c.lines.length : c.items.length));
}

/** `**bold**` runs as <strong>; an unmatched `**` stays as typed. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  return parts.map((part, i) =>
    /^\*\*[^*\n]+\*\*$/.test(part) ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function ReplyText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {chunks(text).map((chunk, i) => {
        if (chunk.kind === "p")
          return (
            <p key={i}>
              {chunk.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(line)}
                </Fragment>
              ))}
            </p>
          );
        const List = chunk.kind;
        return (
          <List
            key={i}
            className={`flex flex-col gap-1 pl-5 ${chunk.kind === "ul" ? "list-disc" : "list-decimal"}`}
          >
            {chunk.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
