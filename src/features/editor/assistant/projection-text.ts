import type { PhotoShape } from "./issue-context";

// Small text helpers the projection's parts share (#309).

/** At most `n` characters, a cut marked with the `[…]` the prompt explains. */
export const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, Math.max(0, n - 4)).trimEnd()} […]` : s;

export const quote = (s: string) => `"${s.replace(/\s+/g, " ").trim()}"`;

/** "landscape 1600×1067": all the model learns about a photo it hasn't viewed. */
export function shape(info: PhotoShape | undefined): string {
  if (!info?.width || !info.height) return "shape unknown";
  const r = info.width / info.height;
  const kind = r > 1.1 ? "landscape" : r < 0.9 ? "portrait" : "square";
  return `${kind} ${info.width}×${info.height}`;
}
