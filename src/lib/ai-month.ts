import { z } from "zod";

// Calendar months for the assistant's usage page (#314). The ledger's months
// are UTC (docs/ai-assistant.md → Budget), so every helper here is too; a
// month travels as "YYYY-MM", the shape `?month=` carries in the URL and
// `monthOf` (src/server/ai-budget.ts) returns.

export type Month = string;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `?month=` as typed by anyone: malformed or absent reads as null. */
export const monthParamSchema = z
  .string()
  .regex(MONTH_PATTERN)
  .nullable()
  .catch(null);

/** The first instant of the month, UTC. */
export function monthStart(month: Month): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export function shiftMonth(month: Month, by: number): Month {
  const d = monthStart(month);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

/** Months from `from` to `to` inclusive, newest first. */
export function monthsBetween(from: Month, to: Month): Month[] {
  const months: Month[] = [];
  for (let m = to; m >= from; m = shiftMonth(m, -1)) months.push(m);
  return months;
}

const monthFormat = new Intl.DateTimeFormat("en-NZ", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "September 2026". */
export function monthLabel(month: Month): string {
  return monthFormat.format(monthStart(month));
}
