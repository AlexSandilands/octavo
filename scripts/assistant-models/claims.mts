// Structural edits a reply says it made, and the tools that could have made
// them (#315, #360). A claim is an edit verb, first person or bare ("I then
// removed…", "Removed the…", "…, removing the…"), whose object is a whole
// block or page. One that is negated, offered or planned ("no blocks were
// deleted", "I can remove…", "I'll split…") isn't, and neither is wording
// inside a block ("removed a sentence from each paragraph"), which is
// set_text's.

const WORD = String.raw`[\p{L}\p{N}'’-]+`;
/** Words between a verb and its object: never a preposition, so the object
 *  is the verb's own ("removed a clause from the paragraph" isn't). */
const GAP = String.raw`(?:(?!(?:from|in|into|of|on|onto|to|at|within|across|inside|with|by|for|under|over|before|after|between|about|as|and|but)\b)${WORD}\s+){0,5}?`;
/** A whole block: not "paragraph breaks", "photo captions", "heading's kicker". */
const BLOCK = String.raw`(?:(?:text )?blocks?|paragraphs?|headings?|photos?|images?|pictures?)(?![’'\p{L}-])(?!\s+(?:breaks?|spacing|marks?|captions?|credits?|alt|kickers?|titles?|text|wording|words|styles?|layout|sizes?|widths?)\b)`;
const PAGES = String.raw`(?:new |extra |blank |continuation |more )*pages?\b`;

const CLAIMS: { said: RegExp[]; what: string; tools: string[] }[] = [
  {
    said: [
      new RegExp(
        `\\b(?:removed|deleted|removing|deleting)\\s+${GAP}${BLOCK}`,
        "giu",
      ),
      new RegExp(
        `\\b${BLOCK}\\s+(?:were|was|have been|has been|are now|is now)\\s+(?:removed|deleted)\\b`,
        "giu",
      ),
    ],
    what: "removed blocks",
    tools: ["delete_block", "remove_cover_item", "clear_cover_background"],
  },
  {
    said: [
      new RegExp(`\\b(?:moved|moving)\\s+${GAP}${BLOCK}`, "giu"),
      new RegExp(`\\b(?:moved|moving)\\b[^.;:!?\\n]*\\bpages?\\b`, "giu"),
    ],
    what: "moved a block",
    tools: ["move_block", "split_page", "place_cover_item"],
  },
  {
    said: [
      new RegExp(`\\b(?:split|splitting)\\s+(?:the |this )?page\\b`, "giu"),
      new RegExp(
        `\\b(?:split|splitting|carried|carrying)\\s+${GAP}(?:onto|over|across|to|into)\\s+(?:the |a |an |two |three )?(?:next |following )?${PAGES}`,
        "giu",
      ),
    ],
    what: "split a page",
    tools: ["split_page", "move_block", "add_page"],
  },
  {
    said: [
      new RegExp(
        `\\b(?:added|adding|created|creating|inserted|inserting)\\s+${GAP}${PAGES}`,
        "giu",
      ),
    ],
    what: "added pages",
    tools: ["add_page", "split_page"],
  },
];

/** Words just before a claim that make it not one: negated, offered, planned. */
const NOT_DONE =
  /\b(?:no|not|never|nothing|none|without|instead|rather|can|could|will|would|shall|should|may|might|want|wants|like|to|if|let|need|needs|able|going|try)\b|n['’]t\b|['’](?:ll|d)\b/iu;

/** Whether the last words of the claim's own clause withdraw it, or it asks. */
function withdrawn(reply: string, at: number): boolean {
  const end = reply.slice(at).search(/[.!?\n]/);
  if (end >= 0 && reply[at + end] === "?") return true;
  const clause =
    reply
      .slice(0, at)
      .split(/[.!?;:,\n—–(]/)
      .at(-1) ?? "";
  return NOT_DONE.test(clause.trim().split(/\s+/).slice(-3).join(" "));
}

/** Edits the reply says it made that no tool made, as "reply claims …". */
export function claimFailures(
  reply: string,
  calls: { name: string; mutated: boolean }[],
): string[] {
  const made = new Set(calls.filter((c) => c.mutated).map((c) => c.name));
  return CLAIMS.filter(
    (c) =>
      !c.tools.some((t) => made.has(t)) &&
      c.said.some((re) =>
        [...reply.matchAll(re)].some((m) => !withdrawn(reply, m.index)),
      ),
  ).map(
    (c) =>
      `reply claims an edit no tool made: ${c.what} (no ${c.tools.join(" / ")})`,
  );
}
