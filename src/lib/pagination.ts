import { z } from "zod";

// What a page means for every admin list: members, issues and sponsors all read
// `?page=` with this schema, hold this many rows, and clamp with these bounds.

// One size for every admin list, so they read alike and the offset maths, the
// tables and the gate script can never drift onto different numbers.
export const ADMIN_LIST_PAGE_SIZE = 25;

// `?page=` arrives attacker-typed (arrays, "abc", "-1"); `catch` turns anything
// malformed into the first page. The query layer clamps out-of-range values.
export const pageParamSchema = z.coerce.number().int().min(1).catch(1);

export type PagedList<T> = {
  /** The rows for the effective page, in the list's fixed order. */
  rows: T[];
  /** The page actually served — the requested one clamped into range. */
  page: number;
  pageCount: number;
  /**
   * The rows the pagination spans — every row in the list, unless a search or
   * filter narrows it (only the members list has either). Drives the page
   * count, so it is the number a summary line must quote to stay true on every
   * page.
   */
  matching: number;
};

// A requested page clamped into the range `matching` rows have, with the offset
// to read it from. Out of range lands on the nearest real page; empty is one
// page.
export function pageBounds(
  matching: number,
  pageSize: number,
  requested = 1,
): { page: number; pageCount: number; offset: number } {
  const pageCount = Math.max(1, Math.ceil(matching / pageSize));
  const page = Math.min(Math.max(1, requested), pageCount);
  return { page, pageCount, offset: (page - 1) * pageSize };
}
