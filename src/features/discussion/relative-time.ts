// "3 days ago" for a comment, with the full date for its `title` (issue #301).

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en-NZ", { numeric: "auto" });
const full = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "long",
  timeStyle: "short",
});

export function relativeTime(iso: string, now: number): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.trunc(seconds / size), unit);
    }
  }
  return "just now";
}

export function fullDate(iso: string): string {
  return full.format(new Date(iso));
}
