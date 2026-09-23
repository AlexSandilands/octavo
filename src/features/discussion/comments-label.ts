/** "12 comments" / "1 comment" — the cards' line and the controls' names. */
export function commentsLabel(n: number): string {
  return `${n.toLocaleString("en-NZ")} ${n === 1 ? "comment" : "comments"}`;
}
