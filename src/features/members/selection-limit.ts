// The most member ids one bulk action may carry.
//
// This is a transport bound, not a guess at how big a club gets. A server
// action's request body is capped at 1 MB by default, and 10,000 uuids is
// ~390 KB of JSON — so this is the largest selection that reliably survives
// the round trip in both directions (the ids come down from
// matchingMemberIdsAction and go back up with the action that acts on them).
//
// Both ends enforce it, which is the whole point: "Select all N matching"
// stops at this number and says so, so the UI can never hand a bulk action a
// selection the action refuses. A cap only the server knew about surfaced as
// the generic "please try again", which an admin could only retry into forever
// (#125) — the same failure #124 fixed for the import cap.
//
// It sits well clear of anything reachable by accident: the club is ~1000
// members and one CSV import carries at most MEMBERS_IMPORT_MAX (5000), so it
// takes two maximum-size imports before a selection can even reach the cap.
// Plain module (no directive): imported by both the server action and the
// client table/bulk bar.
export const MEMBERS_SELECTION_MAX = 10000;
