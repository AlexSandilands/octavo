// next/image as Next's bundler presents it: the component as the default
// export. Loaded in place of "next/image" by render.ts's resolve hook, so it
// loads the real module by path (resolving the name would find itself).
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const real = require(
  join(dirname(require.resolve("next/package.json")), "image.js"),
) as { default: unknown; getImageProps: unknown };
const Image = real.default;
export default Image;
export const getImageProps = real.getImageProps;
