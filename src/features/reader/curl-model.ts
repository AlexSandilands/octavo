// Geometry for the shaded curl (variant E): the sheet is a hinge chain of
// STRIPS flat sections rotating about the spine. Everything the animation
// needs — each section's angle, its tilt toward the viewer, how far the sheet
// reaches over either page, and how high it lifts — is sampled here once per
// turn, and handed to the browser as linear keyframes. No per-frame JS.

export const STRIPS = 6;
/** Total bend across the sheet at the peak of the turn, in degrees. */
export const DEFAULT_BEND = 48;
/** Root rotation easing: quick off the page, soft landing. */
const EASE: [number, number, number, number] = [0.3, 0.08, 0.22, 1];

export type CurlSample = {
  /** Progress 0..1. */
  t: number;
  /** Root section's rotation and each joint's relative bend, in degrees, both
   *  signed for a forward turn (mirror for backward). */
  root: number;
  joints: number[];
  /** Sheet angle at each of the STRIPS+1 section boundaries, in degrees,
   *  signed for a forward turn — the shading is interpolated between them so
   *  it runs continuously across the sections. */
  vertices: number[];
  /** Projected reach over the origin page (≥0) and the destination page (≤0),
   *  measured from the spine in the sheet's own units (w = one page width). */
  coverOrigin: number;
  coverDest: number;
  /** Highest point of the sheet above the pages, as a fraction of w. */
  lift: number;
};

// Cubic-bezier easing (the CSS timing function), solved for x = t.
function bezier([x1, y1, x2, y2]: typeof EASE, t: number) {
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(x) < 1e-5 || dx === 0) break;
    u -= x / dx;
  }
  return ((ay * u + by) * u + cy) * u;
}

// How much of the total bend each joint carries: paper is held at the spine
// and flexes most toward its free edge.
const JOINT_WEIGHTS = Array.from({ length: STRIPS - 1 }, (_, j) => j + 1);
const WEIGHT_SUM = JOINT_WEIGHTS.reduce((a, b) => a + b, 0);

// The bend's envelope over the turn: the edge starts dragging as soon as the
// sheet lifts, peaks a little before edge-on, and settles flat before landing.
function bendEnvelope(t: number) {
  return Math.sin(Math.PI * Math.pow(t, 0.75));
}

/**
 * Sample the turn. `w` is one page width and `perspective` the stage's
 * perspective distance, both in px; the perspective origin is assumed to sit
 * on the spine (the stage is 2·w wide and the spine is its centre).
 */
export function sampleCurl(
  w: number,
  perspective: number,
  bend = DEFAULT_BEND,
  steps = 30,
): CurlSample[] {
  const sw = w / STRIPS;
  const out: CurlSample[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const root = -180 * bezier(EASE, t);
    const env = bend * bendEnvelope(t);
    // Joints bend against the rotation, so the free edge lags the spine.
    const joints = JOINT_WEIGHTS.map((wt) => (env * wt) / WEIGHT_SUM);
    const angles: number[] = [];
    let angle = root;
    let x = 0;
    let z = 0;
    let coverOrigin = 0;
    let coverDest = 0;
    let lift = 0;
    for (let i = 0; i < STRIPS; i++) {
      if (i > 0) angle += joints[i - 1]!;
      angles.push(angle);
      const rad = (angle * Math.PI) / 180;
      // CSS rotateY(θ) carries local +x to (cos θ, 0, −sin θ); z faces the viewer.
      x += sw * Math.cos(rad);
      z -= sw * Math.sin(rad);
      const projected = (x * perspective) / (perspective - z);
      coverOrigin = Math.max(coverOrigin, projected);
      coverDest = Math.min(coverDest, projected);
      lift = Math.max(lift, z);
    }
    // A boundary faces halfway between the sections it joins.
    const vertices = angles.map((a, i) =>
      i === 0 ? a : (angles[i - 1]! + a) / 2,
    );
    vertices.push(angles[STRIPS - 1]!);
    out.push({
      t,
      root,
      joints,
      vertices,
      coverOrigin: coverOrigin / w,
      coverDest: coverDest / w,
      lift: lift / w,
    });
  }
  return out;
}

/** Light from the reader's front-left: a fixed lamp, so a forward and a
 *  backward turn are lit differently, as they would be on a desk. */
const LIGHT = [-0.35, 1] as const;
const LIGHT_LEN = Math.hypot(LIGHT[0], LIGHT[1]);
/** Brightness of a face flat on the page, the reference for no shading. */
const FLAT = 1 / LIGHT_LEN;

/**
 * Shading for a face of the sheet at a signed angle (degrees, as rotated in
 * CSS): how much to darken it (turned from the lamp) or lighten it (turned
 * toward the lamp), each 0..1 relative to a face lying flat.
 */
export function lighting(angleDeg: number, rear: boolean) {
  const rad = (angleDeg * Math.PI) / 180;
  // CSS rotateY carries a front face's normal (+z) to (sin θ, 0, cos θ).
  const flip = rear ? -1 : 1;
  const brightness =
    (flip * (Math.sin(rad) * LIGHT[0] + Math.cos(rad) * LIGHT[1])) / LIGHT_LEN;
  return {
    dark: Math.min(1, Math.max(0, (FLAT - brightness) / FLAT)),
    light: Math.min(1, Math.max(0, (brightness - FLAT) / (1 - FLAT))),
  };
}
