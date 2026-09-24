import { searchPattern } from "./thread-view";

/** `text` with each match of the search marked. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const pattern = searchPattern(query, true);
  if (!pattern) return text;
  return text.split(pattern).map((part, i) =>
    i % 2 ? (
      <mark key={i} className="bg-alert/35 text-ink rounded-[3px]">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
