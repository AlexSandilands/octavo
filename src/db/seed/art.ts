// Generated placeholder art for the seed (issue #58). Every seed image is
// rasterized from an SVG composed here — no committed binaries — so the seed is
// fully self-contained on any machine and any deploy. The pieces are deliberate
// abstract editorial art (gradient landscape washes, duotone geometry, contour
// fields, an engraved cover plate), not noise: each draws from a small
// per-magazine palette with deterministic variation — a PRNG seeded from the
// image key — so every run yields identical art and dimensions.
//
// Deliberately no <text>: librsvg (sharp's SVG rasterizer) resolves fonts from
// the host system, and a slim deploy container may have none — pure geometry
// renders identically everywhere.

// A magazine's art palette, darkest to lightest plus one accent.
type Palette = {
  deep: string;
  mid: string;
  light: string;
  accent: string;
};

export type ArtStyle =
  | { kind: "wash" } // layered ridge landscape under a gradient sky
  | { kind: "duotone"; motif: "stripes" | "arcs" | "triangles" }
  | { kind: "field"; motif: "rings" | "dots" } // contour rings / dot falloff
  | { kind: "plate" }; // engraved-ornament cover plate

export type SeedArtSpec = {
  /** Logical image name; also the storage key (`seed/<key>.webp`) and PRNG seed. */
  key: string;
  width: number;
  height: number;
  palette: Palette;
  style: ArtStyle;
};

// FNV-1a hash → mulberry32: a tiny deterministic PRNG so art varies piece to
// piece but never run to run.
function rngFor(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Number(n.toFixed(1));

function vGradient(id: string, from: string, to: string): string {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient>`
  );
}

// A soft ridge line across the full width: two layered sine waves sampled into
// a polygon that closes down past the bottom edge.
function ridgePath(
  w: number,
  h: number,
  baseY: number,
  rnd: () => number,
): string {
  const a1 = h * (0.03 + rnd() * 0.05);
  const a2 = h * (0.01 + rnd() * 0.02);
  const f1 = 1.2 + rnd() * 1.4;
  const f2 = 3.5 + rnd() * 2.5;
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const x = (w * i) / 48;
    const t = (i / 48) * Math.PI * 2;
    const y = baseY + a1 * Math.sin(f1 * t + p1) + a2 * Math.sin(f2 * t + p2);
    pts.push(`${f(x)},${f(y)}`);
  }
  return `M -4,${f(baseY)} L ${pts.join(" ")} L ${w + 4},${h + 4} L -4,${h + 4} Z`;
}

// Gradient sky, a low sun, and three ridges stepping forward from haze to deep
// foreground — an abstract landscape.
function wash(spec: SeedArtSpec, rnd: () => number): string {
  const { width: w, height: h, palette: p } = spec;
  const sunX = w * (0.2 + rnd() * 0.6);
  const sunY = h * (0.18 + rnd() * 0.2);
  const sunR = Math.min(w, h) * (0.09 + rnd() * 0.06);
  const ridges = [
    { y: h * (0.52 + rnd() * 0.06), fill: p.mid, opacity: 0.35 },
    { y: h * (0.66 + rnd() * 0.06), fill: p.mid, opacity: 0.75 },
    { y: h * (0.8 + rnd() * 0.05), fill: p.deep, opacity: 1 },
  ];
  return (
    `<defs>${vGradient("sky", p.light, p.mid)}` +
    `<radialGradient id="sun"><stop offset="0" stop-color="${p.accent}" stop-opacity="0.9"/>` +
    `<stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>` +
    `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(sunR * 2.6)}" fill="url(#sun)"/>` +
    `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(sunR)}" fill="${p.accent}" opacity="0.85"/>` +
    ridges
      .map(
        (r) =>
          `<path d="${ridgePath(w, h, r.y, rnd)}" fill="${r.fill}" opacity="${r.opacity}"/>`,
      )
      .join("")
  );
}

// Wide diagonal bands in the two dark tones over the light ground, with a few
// narrow accent bands.
function stripes(spec: SeedArtSpec, rnd: () => number): string {
  const { width: w, height: h, palette: p } = spec;
  const angle = -22 + rnd() * 10;
  const span = w + h; // covers the rotated canvas
  const bands: string[] = [];
  let x = -span * 0.55;
  let i = 0;
  while (x < span * 0.55 + w) {
    const wide = 60 + rnd() * 130;
    const accent = rnd() < 0.16;
    const bw = accent ? 16 + rnd() * 14 : wide;
    const fill = accent ? p.accent : i % 2 ? p.mid : p.deep;
    if (accent || rnd() > 0.12) {
      bands.push(
        `<rect x="${f(x)}" y="${-span}" width="${f(bw)}" height="${span * 3}" fill="${fill}"/>`,
      );
    }
    x += bw + 30 + rnd() * 55;
    i++;
  }
  return (
    `<rect width="${w}" height="${h}" fill="${p.light}"/>` +
    `<g transform="rotate(${f(angle)} ${w / 2} ${h / 2})">${bands.join("")}</g>`
  );
}

// A tile grid of quarter-circles in rotating orientations — some tiles left
// empty, a few in the accent — a mid-century pattern.
function arcs(spec: SeedArtSpec, rnd: () => number): string {
  const { width: w, height: h, palette: p } = spec;
  const cols = Math.max(4, Math.round(w / 320));
  const size = w / cols;
  const rows = Math.max(2, Math.round(h / size));
  const tiles: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = rnd();
      if (roll < 0.18) continue; // breathing room
      const fill = roll < 0.3 ? p.accent : roll < 0.66 ? p.mid : p.deep;
      const x = c * size;
      const y = r * size;
      const corner = Math.floor(rnd() * 4);
      const cx = corner === 1 || corner === 2 ? x + size : x;
      const cy = corner >= 2 ? y + size : y;
      tiles.push(
        `<clipPath id="t${r}-${c}"><rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}"/></clipPath>` +
          `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(size)}" fill="${fill}" clip-path="url(#t${r}-${c})"/>`,
      );
    }
  }
  return `<rect width="${w}" height="${h}" fill="${p.light}"/>${tiles.join("")}`;
}

// Rows of alternating up/down pennant triangles — bunting.
function triangles(spec: SeedArtSpec, rnd: () => number): string {
  const { width: w, height: h, palette: p } = spec;
  const rows = Math.max(3, Math.round(h / 210));
  const rh = h / rows;
  const tw = rh * 1.05;
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const offset = -rnd() * tw;
    for (let x = offset; x < w; x += tw) {
      const roll = rnd();
      if (roll < 0.14) continue;
      const fill = roll < 0.28 ? p.accent : roll < 0.64 ? p.mid : p.deep;
      const up = (r + Math.round(x / tw)) % 2 === 0;
      const points = up
        ? `${f(x)},${f(y + rh)} ${f(x + tw)},${f(y + rh)} ${f(x + tw / 2)},${f(y)}`
        : `${f(x)},${f(y)} ${f(x + tw)},${f(y)} ${f(x + tw / 2)},${f(y + rh)}`;
      out.push(`<polygon points="${points}" fill="${fill}"/>`);
    }
  }
  return `<rect width="${w}" height="${h}" fill="${p.light}"/>${out.join("")}`;
}

// Concentric wobbling ellipses stepping out from an off-centre focus — a
// contour map — with an accent point at the eye.
function rings(spec: SeedArtSpec, rnd: () => number): string {
  const { width: w, height: h, palette: p } = spec;
  const cx = w * (0.3 + rnd() * 0.4);
  const cy = h * (0.32 + rnd() * 0.36);
  const step = Math.min(w, h) / 16;
  const count = Math.ceil((Math.max(w, h) / step) * 1.4);
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const rx = step * i * (0.95 + rnd() * 0.14);
    const ry = step * i * (0.8 + rnd() * 0.16);
    const rot = (rnd() - 0.5) * 14;
    const major = i % 4 === 0;
    out.push(
      `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ` +
        `transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" fill="none" ` +
        `stroke="${major ? p.deep : p.mid}" stroke-width="${major ? 7 : 3.5}" ` +
        `opacity="${major ? 0.95 : 0.75}"/>`,
    );
  }
  return (
    `<rect width="${w}" height="${h}" fill="${p.light}"/>${out.join("")}` +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${step * 0.55}" fill="${p.accent}"/>`
  );
}

// A dot grid whose dots swell toward an off-centre focus, deep near the eye and
// fading to the mid tone at the rim.
function dots(spec: SeedArtSpec, rnd: () => number): string {
  const { width: w, height: h, palette: p } = spec;
  const fx = w * (0.28 + rnd() * 0.44);
  const fy = h * (0.3 + rnd() * 0.4);
  const gap = Math.min(w, h) / 14;
  const reach = Math.hypot(w, h) * 0.62;
  const out: string[] = [];
  for (let y = gap / 2; y < h; y += gap) {
    for (let x = gap / 2; x < w; x += gap) {
      const d = Math.hypot(x - fx, y - fy) / reach;
      const t = Math.max(0, 1 - d);
      const r = gap * (0.06 + 0.36 * t * t);
      if (r < gap * 0.07) continue;
      const fill = t > 0.72 ? p.accent : t > 0.4 ? p.deep : p.mid;
      out.push(
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" opacity="${f(0.35 + 0.65 * t)}"/>`,
      );
    }
  }
  return `<rect width="${w}" height="${h}" fill="${p.light}"/>${out.join("")}`;
}

// An engraved-style cover plate: double border rules, a central medallion of
// concentric circles with radiating ticks, and corner diamonds. Reads as a
// typographic ornament without depending on any font.
function plate(spec: SeedArtSpec, rnd: () => number): string {
  const { width: w, height: h, palette: p } = spec;
  const m = Math.min(w, h) * 0.06;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * (0.24 + rnd() * 0.03);
  const ticks: string[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const long = i % 3 === 0;
    const r1 = R * 1.12;
    const r2 = R * (long ? 1.32 : 1.22);
    ticks.push(
      `<line x1="${f(cx + r1 * Math.cos(a))}" y1="${f(cy + r1 * Math.sin(a))}" ` +
        `x2="${f(cx + r2 * Math.cos(a))}" y2="${f(cy + r2 * Math.sin(a))}" ` +
        `stroke="${p.deep}" stroke-width="${long ? 5 : 2.5}"/>`,
    );
  }
  const diamond = (dx: number, dy: number) =>
    `<path d="M ${f(dx)},${f(dy - m * 0.5)} L ${f(dx + m * 0.5)},${f(dy)} L ${f(dx)},${f(dy + m * 0.5)} L ${f(dx - m * 0.5)},${f(dy)} Z" fill="${p.mid}"/>`;
  return (
    `<rect width="${w}" height="${h}" fill="${p.light}"/>` +
    `<rect x="${f(m)}" y="${f(m)}" width="${f(w - 2 * m)}" height="${f(h - 2 * m)}" fill="none" stroke="${p.deep}" stroke-width="6"/>` +
    `<rect x="${f(m * 1.6)}" y="${f(m * 1.6)}" width="${f(w - 3.2 * m)}" height="${f(h - 3.2 * m)}" fill="none" stroke="${p.mid}" stroke-width="2"/>` +
    ticks.join("") +
    `<circle cx="${cx}" cy="${cy}" r="${f(R)}" fill="none" stroke="${p.deep}" stroke-width="6"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${f(R * 0.78)}" fill="none" stroke="${p.mid}" stroke-width="3"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${f(R * 0.5)}" fill="${p.mid}" opacity="0.25"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${f(R * 0.16)}" fill="${p.accent}"/>` +
    diamond(m * 2.6, m * 2.6) +
    diamond(w - m * 2.6, m * 2.6) +
    diamond(m * 2.6, h - m * 2.6) +
    diamond(w - m * 2.6, h - m * 2.6)
  );
}

// Render a spec to a standalone SVG document at its natural pixel size (sharp
// rasterizes at the declared width/height, so the seed's recorded dimensions
// match the stored bytes exactly).
export function renderArtSvg(spec: SeedArtSpec): string {
  const rnd = rngFor(spec.key);
  const { kind } = spec.style;
  const body =
    kind === "wash"
      ? wash(spec, rnd)
      : kind === "plate"
        ? plate(spec, rnd)
        : kind === "duotone"
          ? spec.style.motif === "stripes"
            ? stripes(spec, rnd)
            : spec.style.motif === "arcs"
              ? arcs(spec, rnd)
              : triangles(spec, rnd)
          : spec.style.motif === "rings"
            ? rings(spec, rnd)
            : dots(spec, rnd);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" ` +
    `height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">${body}</svg>`
  );
}
