import { MAX_MANIFEST_BYTES } from "@/lib/issue-transfer/limits";
import {
  manifestSchema,
  MANIFEST_PATH,
  type BundleManifest,
} from "@/lib/issue-transfer/manifest";

// Read `manifest.json` out of a chosen file and nothing else: the unzip seeks to
// the archive's directory through `File.slice`, so a quarter-gigabyte bundle
// never goes into memory. Imported here, when a file is chosen, to stay out of
// the dashboard's bundle.

// Far past a real bundle's entry count; no reason to keep walking.
const MAX_SCANNED_ENTRIES = 20_000;

export async function readBundleManifest(
  file: File,
): Promise<BundleManifest | null> {
  const zip = await import("@zip.js/zip.js");
  // Workers off: the nonce CSP allows `worker-src 'self'`, so the blob worker
  // zip.js would otherwise spawn is blocked outright.
  zip.configure({ useWebWorkers: false });

  const reader = new zip.ZipReader(new zip.BlobReader(file));
  try {
    let scanned = 0;
    for await (const entry of reader.getEntriesGenerator()) {
      if (++scanned > MAX_SCANNED_ENTRIES) return null;
      if (entry.directory || entry.filename !== MANIFEST_PATH) continue;
      if (entry.uncompressedSize > MAX_MANIFEST_BYTES) return null;
      const text = await entry.getData(new zip.TextWriter());
      const parsed = manifestSchema.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : null;
    }
    return null;
  } catch {
    return null;
  } finally {
    await reader.close().catch(() => {});
  }
}
