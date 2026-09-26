// Imported first by check-assistant-models.mts: next/image is CommonJS with its
// component on `exports.default`, so outside Next's bundler its default import
// is the module object and React refuses it. This resolve hook swaps in a shim
// before any app module (the editor's blocks, PrintDocument) loads it.
import { registerHooks } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const shim = pathToFileURL(
  join(import.meta.dirname, "next-image-node.mts"),
).href;
registerHooks({
  resolve: (specifier, context, next) =>
    next(specifier === "next/image" ? shim : specifier, context),
});
