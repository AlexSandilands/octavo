// The most issue ids one bulk delete may carry.
//
// Both ends enforce it: "Select all N matching" stops here and says so, so the
// UI can never hand the action a selection it would refuse — a cap only the
// server knew about surfaced as a generic "please try again" the admin could
// only retry into forever (#125).
//
// Well clear of anything reachable by accident: a club's whole archive is tens
// of issues, and the bound is what one request can finish — a delete carries a
// reference scan over every content document plus a storage sweep per issue.
// Plain module (no directive): imported by both the server action and the
// client table/bulk bar.
export const ISSUES_SELECTION_MAX = 500;
