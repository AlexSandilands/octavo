import type { ReactNode } from "react";
import type { ResolvedImage } from "@/lib/images";

// Presentational pieces shared by the layout-theme modules (classic/modern/…).
// Kept theme-agnostic so each theme composes them without duplicating markup.

// A sponsor logo, contained within its fixed slot at whatever aspect it has.
// A plain <img> (not next/image) because the slot is a fixed box and object-fit
// does the work; logos are small, so intrinsic-size optimisation isn't worth it.
export function SponsorLogo({
  logo,
  name,
}: {
  logo: ResolvedImage;
  name: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.url}
      alt={name ? `${name} logo` : "Sponsor logo"}
      className="h-full w-full object-contain"
    />
  );
}

// The shared, theme-independent data a theme's sponsor card renders from.
// BlockView resolves the v1/v2 sponsor compatibility (managed vs inline, deleted
// references, editable fields) once and hands the result to `theme.sponsor`, so
// a theme only decides layout — never the resolution rules.
export type SponsorCardProps = {
  /** Display name (resolved from the managed sponsor or the inline field). */
  name: string;
  /** Resolved logo image, or null when there is none / the sponsor was removed. */
  logo: ResolvedImage | null;
  /** True when the block references a managed sponsor (vs an inline/v1 entry). */
  isManaged: boolean;
  /** True in the editor for an inline entry — name/href render in-place editable. */
  editable: boolean;
  /** The validated external href, or null (read-only, no safe link). */
  link: string | null;
  /** The name, as an editable field (editor) or plain text (reader). */
  nameField: ReactNode;
  /** The editable href field (editor, inline entries only), else null. */
  hrefField: ReactNode;
};
