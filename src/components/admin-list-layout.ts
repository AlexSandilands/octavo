// Layout for the admin list pages (issues, members, sponsors): the heading,
// its actions, the search and filters and any bulk bar stay put while only the
// rows scroll — from the sidebar breakpoint (md) up. On a phone that would
// leave a few rows under half a screen of controls, so the pane scrolls as a
// whole there and only the search row sticks, the way a mobile list keeps its
// search to hand while the heading scrolls away. The four classes below are
// the layers of that, outermost first; each page composes them in order.

// The page's root, directly inside the admin pane: a column that fills the
// pane from md up so the rows region can take the remaining height.
export const ADMIN_LIST_PAGE = "flex flex-col md:h-full md:min-h-0";

// The table's root. Below md the top margin is the usual gap plus the pane's
// padding, which the sticky toolbar pulls itself back up through — so its
// pull-up lands on empty space rather than over the header's buttons.
export const ADMIN_LIST_TABLE =
  "mt-12 flex flex-col sm:mt-13 md:mt-5 md:min-h-0 md:flex-1";

// The search + filter row. The pane's padding insets where a sticky box parks,
// so the row is pulled up by that padding (into the margin reserved above) and
// padded back down: it sits where it did at rest and, once stuck, its card
// background covers the gap the rows would otherwise scroll through. From md
// up it sits in the pinned block and needs none of this.
export const ADMIN_LIST_TOOLBAR =
  "bg-card sticky -top-7 z-10 -mt-7 flex flex-col gap-3 pt-7 pb-3 sm:-top-8 sm:-mt-8 sm:pt-8 md:static md:mt-0 md:flex-none md:pt-0 md:pb-0 lg:flex-row";

// The rows (with the live result line and the pagination). From md up this is
// the scroll region: the negative margins run it out to the pane's own edges
// (p-8 at md) so the scrollbar hugs the right and the last row reaches the
// bottom, while the restored padding keeps the rows aligned with the header.
// `relative` anchors the sr-only status inside it, not the pane (#189).
// Pagination resets whichever ancestor actually scrolls (see ListPagination).
export const ADMIN_LIST_ROWS =
  "scrollbar-soft relative [--scrollbar-surface:var(--color-card)] md:-mx-8 md:-mb-8 md:min-h-48 md:flex-1 md:overflow-y-auto md:px-8 md:pb-8 md:[scrollbar-gutter:stable]";
