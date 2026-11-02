import type { CoverSource } from "@/lib/cover-elements";
import type { Page } from "@/lib/blocks";
import type { SiteSettings } from "@/lib/branding";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { PageThumb } from "@/features/blocks/page-thumb";

// An issue's cover page as the library/admin thumbnail: a PageThumb of the
// cover, server-rendered with no client JS. Both library surfaces wrap it in a
// card-sized <Link href="/read/…">, which is why PageThumb drops anchors.
export function CoverThumb(props: {
  page: Page;
  sources?: CoverSource[];
  theme: string;
  images: ImageMap;
  /** Required, like `images` — see PageThumb (issue #170). */
  sponsors: SponsorMap;
  issueNo: number;
  /** Branding for the theme decoration; cover thumbnails omit the footer. */
  settings: SiteSettings;
  width: number;
  /** Eager-load the cover image — set only for the hero (LCP), not the archive. */
  priority?: boolean;
}) {
  return <PageThumb {...props} />;
}
