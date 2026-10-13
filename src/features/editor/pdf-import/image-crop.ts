// Where a placed image is visible once its rectangular clips (and the page's
// crop box) are applied, and which source pixels that is. Pure: no DOM.

export type Matrix = [number, number, number, number, number, number];
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Pixels = { x: number; y: number; width: number; height: number };
// `pixels` is null when nothing is cut away: the whole image, unresampled.
export type Crop = { rect: Rect; pixels: Pixels | null };

// A clip within a point of the image's edge doesn't count as a crop.
const TOLERANCE = 1;

export function placementBounds(placement: Matrix): Rect {
  const [a, b, c, d, e, f] = placement;
  const xs = [e, e + a, e + c, e + a + c];
  const ys = [f, f + b, f + d, f + b + d];
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

export function cropOf(
  placement: Matrix,
  clips: Rect[],
  width: number,
  height: number,
): Crop | "skewed" | null {
  const bounds = placementBounds(placement);
  const visible = clips.reduce<Rect>(
    (r, clip) => ({
      x0: Math.max(r.x0, clip.x0),
      y0: Math.max(r.y0, clip.y0),
      x1: Math.min(r.x1, clip.x1),
      y1: Math.min(r.y1, clip.y1),
    }),
    bounds,
  );
  if (visible.x1 <= visible.x0 || visible.y1 <= visible.y0) return null;
  const cut =
    visible.x0 > bounds.x0 + TOLERANCE ||
    visible.y0 > bounds.y0 + TOLERANCE ||
    visible.x1 < bounds.x1 - TOLERANCE ||
    visible.y1 < bounds.y1 - TOLERANCE;
  if (!cut) return { rect: bounds, pixels: null };
  const [a, b, c, d, e, f] = placement;
  if (b !== 0 || c !== 0 || a === 0 || d === 0) return "skewed";
  // Image space: u runs left to right, v bottom to top; row 0 is the top (v = 1).
  const us = [(visible.x0 - e) / a, (visible.x1 - e) / a];
  const vs = [(visible.y0 - f) / d, (visible.y1 - f) / d];
  const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
  const left = clamp(Math.round(Math.min(...us) * width), width);
  const right = clamp(Math.round(Math.max(...us) * width), width);
  const top = clamp(Math.round((1 - Math.max(...vs)) * height), height);
  const bottom = clamp(Math.round((1 - Math.min(...vs)) * height), height);
  if (right - left < 1 || bottom - top < 1) return null;
  // The region follows the rounded pixels so its shape matches the export.
  const xs = [e + (a * left) / width, e + (a * right) / width];
  const ys = [f + d * (1 - top / height), f + d * (1 - bottom / height)];
  return {
    rect: {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys),
    },
    pixels: { x: left, y: top, width: right - left, height: bottom - top },
  };
}
