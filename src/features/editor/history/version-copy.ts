import type { VersionReason } from "@/lib/issue-versions";

// The words the History tab and the version preview share (aboard #51).

export const REASON_LABEL: Record<VersionReason, string> = {
  session: "Start of an editing session",
  hourly: "Hourly copy",
  "large-removal": "Before a large deletion",
  "before-restore": "Before a restore",
};

const day = new Intl.DateTimeFormat("en-NZ", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const time = new Intl.DateTimeFormat("en-NZ", {
  hour: "numeric",
  minute: "2-digit",
});

/** "Today, 2:05 pm" / "Yesterday, 9:10 am" / "Wed 5 Nov, 4:02 pm". */
export function versionTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Math.floor((start.getTime() - at.getTime()) / 86_400_000) + 1;
  const when =
    at >= start ? "Today" : days === 1 ? "Yesterday" : day.format(at);
  return `${when}, ${time.format(at)}`;
}

export const pagesLabel = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
