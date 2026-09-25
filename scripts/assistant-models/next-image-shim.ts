// next/image as Next's bundler presents it, the component as the default
// export. esbuild imports its CommonJS module in Node mode, where the default
// import is the whole exports object; measure.mts swaps this in.
import * as real from "next/dist/shared/lib/image-external";

type Exports = { default?: unknown };
const mod = (real as unknown as Exports).default as Exports | undefined;
const Image = (mod?.default ?? mod) as typeof import("next/image").default;
export default Image;
