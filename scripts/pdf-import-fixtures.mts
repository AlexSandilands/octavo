// Deterministic, redistributable fixtures authored for Octavo; no club documents.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const dir = "scripts/fixtures/pdf-import";
await mkdir(dir, { recursive: true });
const jpeg = await sharp({
  create: {
    width: 240,
    height: 160,
    channels: 3,
    background: { r: 30, g: 100, b: 70 },
  },
})
  .jpeg()
  .toBuffer();
function pdf(
  streams: string[],
  rotation = 0,
  image = true,
  raster = { jpeg, width: 240, height: 160 },
) {
  const objects: Buffer[] = [];
  const put = (s: string | Buffer) => {
    objects.push(typeof s === "string" ? Buffer.from(s) : s);
    return objects.length;
  };
  put("<< /Type /Catalog /Pages 2 0 R >>");
  put(
    `<< /Type /Pages /Kids [${streams.map((_, i) => `${7 + i * 2} 0 R`).join(" ")}] /Count ${streams.length} >>`,
  );
  put("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  put("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  put("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");
  put(
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${raster.width} /Height ${raster.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${raster.jpeg.length} >>\nstream\n`,
      ),
      raster.jpeg,
      Buffer.from("\nendstream"),
    ]),
  );
  for (const [i, stream] of streams.entries()) {
    put(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate ${rotation} /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${image ? "/XObject << /Im1 6 0 R >>" : ""} >> /Contents ${8 + i * 2} 0 R >>`,
    );
    put(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  let offset = 9;
  const chunks = [Buffer.from("%PDF-1.7\n")];
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(offset);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      object,
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(chunk);
    offset += chunk.length;
  });
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
        .join(
          "",
        )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(chunks);
}
const text = (s: string, x: number, y: number, font = "F1", size = 12) =>
  `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${s.replace(/[()\\]/g, "\\$&")}) Tj ET`;
const photo = "q 240 0 0 160 50 300 cm /Im1 Do Q";
// Resizes to 2000 × 1000: slightly taller at the same rendered width (#256).
const boundaryPhoto = await sharp({
  create: { width: 2401, height: 1200, channels: 3, background: "#246544" },
})
  .jpeg()
  .toBuffer();
await writeFile(
  `${dir}/resize-boundary.pdf`,
  pdf(
    [
      text("A resized photograph", 50, 740) +
        "\nq 480.2 0 0 240 50 300 cm /Im1 Do Q",
    ],
    0,
    true,
    {
      jpeg: boundaryPhoto,
      width: 2401,
      height: 1200,
    },
  ),
);
await writeFile(
  `${dir}/single-column.pdf`,
  pdf(
    [
      [
        text("A day by the river", 50, 740, "F2", 24),
        text("This paragraph has readable ordinary text.", 50, 700),
        text("It continues on the next source line.", 50, 684),
        text("Emphasis is editable", 50, 650, "F3"),
        text("Another paragraph starts after a gap.", 50, 615),
        photo,
      ].join("\n"),
      text("Article continued on page two.", 50, 740) + "\n" + photo,
    ].map(String),
  ),
);
await writeFile(
  `${dir}/two-column.pdf`,
  pdf([
    [
      text("Newsletter across two columns", 50, 740, "F2", 24),
      text("Left column first paragraph.", 50, 700),
      text("Left column continuation.", 50, 684),
      text("Right column second paragraph.", 330, 700),
      text("Right column continuation.", 330, 684),
      photo,
      "q 120 0 0 80 340 300 cm /Im1 Do Q",
    ].join("\n"),
  ]),
);
await writeFile(
  `${dir}/rotated.pdf`,
  pdf([text("Rotated selectable text", 50, 740) + "\n" + photo], 90),
);
await writeFile(`${dir}/scan-only.pdf`, pdf([photo]));
// One paragraph far taller than an Octavo page: the measured split must cut it.
await writeFile(
  `${dir}/long-paragraph.pdf`,
  pdf(
    [
      [
        text("An oversized paragraph", 50, 750, "F2", 20),
        ...Array.from({ length: 60 }, (_, i) =>
          text(
            `Line ${String(i + 1).padStart(2, "0")} measured words preserve marks and order across pages.`,
            50,
            720 - i * 11,
            "F1",
            10,
          ),
        ),
      ].join("\n"),
    ],
    0,
    false,
  ),
);
await writeFile(
  `${dir}/malformed.pdf`,
  Buffer.from("%PDF-1.7\nnot a valid document"),
);
console.log("Wrote the deterministic PDF fixtures.");

await writeFile(
  `${dir}/too-many-pages.pdf`,
  pdf(Array.from({ length: 101 }, () => text("Page", 50, 740))),
);
