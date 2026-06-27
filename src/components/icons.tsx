import type { ReactNode } from "react";

// Single line-icon set (outline, currentColor) used across the app.
const ICONS: Record<string, ReactNode> = {
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  arrowRight: <path d="M5 12h13m0 0l-5-5m5 5l-5 5" />,
  menu: <path d="M4 6h16M4 12h16M4 18h10" />,
  download: <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />,
  upload: <path d="M12 15V4m0 0L8 8m4-4l4 4M5 19h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5 9-11" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 10-2.3 5.6M20 11V5m0 6h-6" />,
  zoom: (
    <path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />
  ),
  reader: <path d="M5 6h14M5 10h14M5 14h9M5 18h12" />,
  arrowUp: <path d="M6 15l6-6 6 6" />,
  arrowDown: <path d="M6 9l6 6 6-6" />,
  trash: <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0111 0M16 7a3 3 0 010 6M18.5 19a5.5 5.5 0 00-3-4.9" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  banner: (
    <>
      <path d="M4 7h16v10H4z" />
      <path d="M4 11h16" />
    </>
  ),
  heading: <path d="M6 4v16M18 4v16M6 12h12" />,
  grip: (
    <>
      <circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5L5 19" />
    </>
  ),
  wrapLeft: (
    <>
      <rect x="3" y="4.5" width="8" height="7" rx="1" />
      <path d="M13 6h8M13 10h8M3 15h18M3 19h18" />
    </>
  ),
  wrapRight: (
    <>
      <rect x="13" y="4.5" width="8" height="7" rx="1" />
      <path d="M3 6h8M3 10h8M3 15h18M3 19h18" />
    </>
  ),
  breakText: (
    <>
      <rect x="3" y="4.5" width="18" height="7" rx="1" />
      <path d="M3 15h18M3 19h18" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  listBullet: (
    <>
      <circle cx="5" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9 7h11M9 12h11M9 17h11" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1.4 1.4" />
      <path d="M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1.4-1.4" />
    </>
  ),
  fullscreen: (
    <path d="M9 4H5a1 1 0 00-1 1v4M15 4h4a1 1 0 011 1v4M9 20H5a1 1 0 01-1-1v-4M15 20h4a1 1 0 001-1v-4" />
  ),
  fullscreenExit: (
    <path d="M4 9h4V5M20 9h-4V5M4 15h4v4M20 15h-4v4" />
  ),
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.6,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
