// Renders the app icon (src/lib/site-icon.tsx — the same renderer behind
// /icon and /apple-icon) to a checked-in 256px PNG per brand, for reference
// in docs and mock-ups. The real favicons stay generated at request time; this
// only mirrors them, so re-run it whenever the mark or BRAND_ICON_COLORS move.
// Run: npm run icon
import { mkdir, writeFile } from "node:fs/promises";
import { BRAND_IDS } from "../src/lib/brands.ts";
import { renderSiteIcon } from "../src/lib/site-icon.tsx";

const OUT = "docs/assets";
const PX = 256;

await mkdir(OUT, { recursive: true });
for (const brand of BRAND_IDS) {
  // activeBrand() reads this per call, so one process can render them all.
  process.env.NEXT_PUBLIC_BRAND = brand;
  const png = Buffer.from(await renderSiteIcon(PX).arrayBuffer());
  const path = `${OUT}/icon-${brand}-${PX}.png`;
  await writeFile(path, png);
  console.log(`${path} (${png.length} bytes)`);
}
