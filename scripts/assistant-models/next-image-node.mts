// next/image as Next's bundler presents it, for render.mts's resolve hook: the
// component as the default export. Loads the real module by path (resolving
// the name would find this shim again).
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const real = require(
  join(dirname(require.resolve("next/package.json")), "image.js"),
) as { default: unknown; getImageProps: unknown };
export default real.default;
export const getImageProps = real.getImageProps;
