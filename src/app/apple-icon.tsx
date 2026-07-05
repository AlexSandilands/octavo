import { renderSiteIcon } from "@/lib/site-icon";

// Apple touch icon (180×180) for iOS/iPadOS home-screen bookmarks — a nice-to-
// have for the phone-heavy audience. Same brand-aware mark as the favicon; Next
// auto-injects <link rel="apple-touch-icon">.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderSiteIcon(size.width);
}
