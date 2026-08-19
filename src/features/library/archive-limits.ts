// The three numbers the library's back catalogue is bounded by. Plain module
// (no directive): read by the server data access, the pages and the client
// search box alike, so the two ends of each bound can never disagree.

// Back-issues the home page shows below the featured one. Two full rows of the
// 150px cover grid at the library's max width, which is also about a year of a
// monthly magazine — everything older lives on /archive.
//
// A calendar window (the last 12 months) is deliberately *not* applied on top:
// for a quarterly publisher it would push most of a small catalogue behind the
// archive link, and a catalogue that fits on the home page must keep looking
// the way it does today. Above this many issues the cap is the narrower rule
// anyway, so the run it serves is the recent one either way.
export const HOME_ARCHIVE_MAX = 15;

// Covers per page on /archive — five rows of the same grid.
export const ARCHIVE_PAGE_SIZE = 25;

// The longest `?q=` the archive accepts. The search box enforces it at typing
// time and the page schema truncates URL-borne queries to it, so an overlong
// query still narrows the list instead of being swapped for the whole archive.
export const ARCHIVE_QUERY_MAX = 200;
