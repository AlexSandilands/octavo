// Avatar badge text: first letters of the first two words, uppercased.
// Spread (not [0]) so names starting with an emoji or other astral character
// don't render half a surrogate pair.
export function initials(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word][0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
