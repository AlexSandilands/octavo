import { renderSiteIcon } from "@/lib/site-icon";

// App Router favicon (the /icon route). Next auto-injects the <link rel="icon">
// for it, so browsers use this instead of auto-requesting /favicon.ico — that's
// what kills the site-wide /favicon.ico 404 (issue #56). See lib/site-icon.tsx
// for the brand-aware mark; no layout edits needed.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return renderSiteIcon(size.width);
}
