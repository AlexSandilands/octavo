// Where a placed image is visible once its rectangular clips (and the page's
// crop box) are applied, and which source pixels that is. Pure: no DOM.

export type Matrix = [number, number, number, number, number, number];
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Pixels = { x: number; y: number; width: number; height: number };
// `pixels` is null when nothing is cut away: the whole image, unresampled.
export type Crop = { rect: Rect; pixels: Pixels | null };

// A clip within a point of the image's edge doesn't count as a crop.
const TOLERANCE = 1;
// Float noise in a nominally unrotated matrix or a pixel edge.
const EPSILON = 1e-6;

function placementBounds(placement: Matrix): Rect {
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
  if (Math.abs(b) > EPSILON || Math.abs(c) > EPSILON || !a || !d)
    return "skewed";
  // Image space: u runs left to right, v bottom to top; row 0 is the top (v = 1).
  const us = [(visible.x0 - e) / a, (visible.x1 - e) / a];
  const vs = [(visible.y0 - f) / d, (visible.y1 - f) / d];
  // Edges round inward: a pixel the page hides never comes along.
  const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
  const inward = (n: number, max: number, up: boolean) =>
    clamp(up ? Math.ceil(n - EPSILON) : Math.floor(n + EPSILON), max);
  const left = inward(Math.min(...us) * width, width, true);
  const right = inward(Math.max(...us) * width, width, false);
  const top = inward((1 - Math.max(...vs)) * height, height, true);
  const bottom = inward((1 - Math.min(...vs)) * height, height, false);
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

// What a crop costs against the page's decoded-pixel budget: its own area.
export const cropArea = (crop: Crop, width: number, height: number) =>
  crop.pixels ? crop.pixels.width * crop.pixels.height : width * height;

// Copies row `row` of `crop` from packed RGB (stride 3) or RGBA (4) to RGBA `out`.
export function copyCropRow(
  source: ArrayLike<number>,
  stride: 3 | 4,
  sourceWidth: number,
  crop: Pixels,
  row: number,
  out: Uint8ClampedArray,
) {
  const from = ((crop.y + row) * sourceWidth + crop.x) * stride;
  const to = row * crop.width * 4;
  for (let col = 0; col < crop.width; col++) {
    const s = from + col * stride,
      o = to + col * 4;
    out[o] = source[s]!;
    out[o + 1] = source[s + 1]!;
    out[o + 2] = source[s + 2]!;
    out[o + 3] = stride === 4 ? source[s + 3]! : 255;
  }
}
