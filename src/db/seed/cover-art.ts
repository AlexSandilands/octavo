import type { SeedArtSpec } from "./art";

export type CoverMotif = "aperture" | "regatta" | "kiln";

/** Portrait illustrations leave quiet bands for live, editable cover typography. */
export function coverArt(spec: SeedArtSpec, motif: CoverMotif): string {
  const { deep, mid, light, accent } = spec.palette;
  const scene = {
    aperture: `
      <rect width="640" height="900" fill="${deep}"/>
      <circle cx="420" cy="430" r="238" fill="${accent}"/>
      <circle cx="420" cy="430" r="196" fill="${mid}"/>
      <circle cx="420" cy="430" r="155" fill="${deep}"/>
      <circle cx="420" cy="430" r="112" fill="${light}"/>
      <circle cx="450" cy="405" r="110" fill="${deep}"/>
      <g fill="none" stroke="${light}" stroke-opacity=".24">
        <circle cx="420" cy="430" r="214"/>
        <circle cx="420" cy="430" r="175"/>
        <path d="M 80 218 H 580 M 80 640 H 580"/>
      </g>
      <path d="M 578 255 V 294 M 558 275 H 598" stroke="${light}" stroke-width="2"/>`,
    regatta: `
      <rect width="640" height="900" fill="${deep}"/>
      <path d="M0 248 Q220 205 640 305 V650 H0Z" fill="${mid}"/>
      <circle cx="485" cy="290" r="66" fill="${accent}"/>
      <path d="M0 542 Q180 490 370 547 T740 520 V675 H0Z" fill="${deep}"/>
      <path d="M392 244 L390 536 L235 518Z" fill="${light}"/>
      <path d="M407 304 L520 526 L407 536Z" fill="${light}" opacity=".75"/>
      <path d="M218 548 L529 548 L480 577 L264 577Z" fill="${light}"/>
      <path d="M399 237 V556" stroke="${deep}" stroke-width="5"/>
      <g fill="none" stroke="${light}" stroke-opacity=".28" stroke-width="2">
        <path d="M80 591 Q185 571 300 600 T582 591 M120 624 Q242 603 380 628 T640 617"/>
      </g>`,
    kiln: `
      <rect width="640" height="900" fill="${light}"/>
      <circle cx="446" cy="432" r="210" fill="${mid}" opacity=".24"/>
      <path d="M0 596 Q270 550 640 611 V900 H0Z" fill="${mid}" opacity=".13"/>
      <ellipse cx="397" cy="619" rx="174" ry="25" fill="${deep}" opacity=".12"/>
      <path d="M331 302 H444 L435 360 C435 390 548 420 532 518 C521 584 480 618 388 618 C304 618 257 576 258 512 C260 430 341 390 341 360Z" fill="${mid}"/>
      <path d="M388 302 H444 L435 360 C435 390 548 420 532 518 C521 584 480 618 388 618 C450 555 440 455 396 406Z" fill="${deep}" opacity=".32"/>
      <ellipse cx="388" cy="302" rx="57" ry="12" fill="${deep}"/>
      <ellipse cx="388" cy="302" rx="44" ry="6" fill="${accent}"/>
      <g fill="none" stroke="${light}" stroke-opacity=".25" stroke-width="2">
        <path d="M269 478 Q389 501 523 477 M264 498 Q393 523 532 500 M265 520 Q398 545 530 523 M274 544 Q400 565 522 546 M285 566 Q403 584 510 567"/>
      </g>`,
  }[motif];
  return `<svg x="0" y="0" width="${spec.width}" height="${spec.height}" viewBox="0 0 640 900">${scene}</svg>`;
}

/** Transparent library marks, rasterised by the ordinary seed image pipeline. */
export function coverMark(spec: SeedArtSpec, motif: CoverMotif): string {
  const ink = spec.palette.light;
  const symbol = {
    aperture: `<circle cx="50" cy="50" r="35"/><circle cx="50" cy="50" r="15"/><path d="M50 15L65 35L85 50L65 65L50 85L35 65L15 50L35 35Z"/>`,
    regatta: `<circle cx="50" cy="50" r="43"/><path d="M49 20V65H25ZM56 32L77 65H56ZM22 73Q50 87 78 73"/>`,
    kiln: `<circle cx="50" cy="50" r="43"/><path d="M39 26H61L59 40Q80 52 70 69Q50 83 30 69Q20 52 41 40ZM38 30H62M32 61Q50 68 68 61"/>`,
  }[motif];
  return `<svg width="${spec.width}" height="${spec.height}" viewBox="0 0 100 100"><g fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round">${symbol}</g></svg>`;
}
