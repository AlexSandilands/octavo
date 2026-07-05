// The seed's image manifest: every logical image the issue files can place,
// with the palette, style and natural size its art is generated at (see
// ./art.ts). Grouped by the magazine archetype it belongs to so each issue has
// a consistent visual voice. `SeedImages` maps these keys to the minted image
// row ids the content blocks reference.
import type { SeedArtSpec } from "./art";

// One palette per magazine archetype (deep/mid/light + accent).
const petanque = {
  deep: "#31402f",
  mid: "#5c7153",
  light: "#ece5d3",
  accent: "#c2803e",
};
// The same club at last light — warm sand sky, the green gone nearly black.
const petanqueDusk = {
  deep: "#2c3529",
  mid: "#8a7a52",
  light: "#eedcb8",
  accent: "#c05b2e",
};
const aperture = {
  deep: "#23272e",
  mid: "#5b6470",
  light: "#e8eaed",
  accent: "#d97706",
};
const commons = {
  deep: "#2f4a3a",
  mid: "#6b8f71",
  light: "#f0ead8",
  accent: "#b3552e",
};
const regatta = {
  deep: "#16283f",
  mid: "#33567a",
  light: "#e7eef2",
  accent: "#c94f38",
};
const essay = {
  deep: "#2b2620",
  mid: "#6e5f4b",
  light: "#efe7d6",
  accent: "#8c2f2f",
};
const kiln = {
  deep: "#4a2c1f",
  mid: "#a0522d",
  light: "#f0e0cf",
  accent: "#3f6459",
};

export const SEED_IMAGES = [
  // The Boule & Bay Gazette (pétanque club quarterly — classic theme)
  {
    key: "gravel",
    width: 1600,
    height: 1000,
    palette: petanque,
    style: { kind: "wash" },
  },
  {
    key: "dusk",
    width: 1600,
    height: 1000,
    palette: petanqueDusk,
    style: { kind: "wash" },
  },
  {
    key: "terrain",
    width: 1200,
    height: 1200,
    palette: petanque,
    style: { kind: "field", motif: "rings" },
  },
  // Aperture (camera club — modern theme, image-led)
  {
    key: "silver",
    width: 1600,
    height: 1000,
    palette: aperture,
    style: { kind: "duotone", motif: "stripes" },
  },
  {
    key: "amber",
    width: 1600,
    height: 1000,
    palette: aperture,
    style: { kind: "duotone", motif: "arcs" },
  },
  {
    key: "gridlight",
    width: 1600,
    height: 1000,
    palette: aperture,
    style: { kind: "field", motif: "dots" },
  },
  {
    key: "stillness",
    width: 1000,
    height: 1300,
    palette: aperture,
    style: { kind: "wash" },
  },
  // The Commons (village newsletter — classic theme)
  {
    key: "green",
    width: 1600,
    height: 640,
    palette: commons,
    style: { kind: "wash" },
  },
  {
    key: "fete",
    width: 1600,
    height: 1000,
    palette: commons,
    style: { kind: "duotone", motif: "triangles" },
  },
  // Regatta (sailing club season review — modern theme)
  {
    key: "harbour",
    width: 1600,
    height: 1000,
    palette: regatta,
    style: { kind: "wash" },
  },
  {
    key: "pennants",
    width: 1600,
    height: 640,
    palette: regatta,
    style: { kind: "duotone", motif: "triangles" },
  },
  {
    key: "chart",
    width: 1600,
    height: 1000,
    palette: regatta,
    style: { kind: "field", motif: "rings" },
  },
  // The Marginalia (literary society essay — classic theme)
  {
    key: "plate",
    width: 1200,
    height: 1200,
    palette: essay,
    style: { kind: "plate" },
  },
  // Kiln & Wheel (pottery guild annual — modern theme)
  {
    key: "glaze",
    width: 1600,
    height: 1000,
    palette: kiln,
    style: { kind: "duotone", motif: "arcs" },
  },
  {
    key: "wheel",
    width: 1200,
    height: 1200,
    palette: kiln,
    style: { kind: "field", motif: "rings" },
  },
  {
    key: "emberfield",
    width: 1600,
    height: 640,
    palette: kiln,
    style: { kind: "field", motif: "dots" },
  },
] as const satisfies readonly SeedArtSpec[];

export type SeedImageKey = (typeof SEED_IMAGES)[number]["key"];

// Minted image-row id per logical image; the block builders reference these.
export type SeedImages = Record<SeedImageKey, string>;
