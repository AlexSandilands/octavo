import { cp, mkdir, readFile } from "node:fs/promises";
const { version } = JSON.parse(
  await readFile("node_modules/pdfjs-dist/package.json", "utf8"),
);
const target = `public/pdfjs/${version}`;
await mkdir(target, { recursive: true });
await cp("node_modules/pdfjs-dist/LICENSE", `${target}/LICENSE`);
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  `${target}/pdf.worker.min.mjs`,
);
for (const name of ["cmaps", "standard_fonts"])
  await cp(`node_modules/pdfjs-dist/${name}`, `${target}/${name}`, {
    recursive: true,
  });
