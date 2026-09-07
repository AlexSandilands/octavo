import type { ReactNode } from "react";
import { MagazineName } from "./branding";

// The small typographic marks the chrome is built from: the wordmark, the two
// mono labels, the status pill and the avatar disc. Each
// names the surface it sits on ("paper" or "dark") — see Button in ui.tsx.
export type Tone = "paper" | "dark";

export function Wordmark({
  size = 22,
  tone = "dark",
}: {
  size?: number;
  tone?: Tone;
}) {
  return (
    <span
      className={`font-display ${tone === "dark" ? "text-chrome-text" : "text-ink"}`}
      style={{ fontSize: size, fontWeight: 400, letterSpacing: ".01em" }}
    >
      <MagazineName />
    </span>
  );
}

// A typed shelf label: mono, tracked, small caps. Kicker is the brass one,
// Label the quiet one. Both are 12px — the floor for a label this audience
// has to read — and never carry more than a few words.
const MONO_LABEL =
  "font-meta text-[12px] font-medium tracking-[0.14em] uppercase";

export function Kicker({
  children,
  tone = "paper",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={`${MONO_LABEL} ${tone === "dark" ? "text-brass" : "text-brass-ink"}`}
    >
      {children}
    </div>
  );
}

export function Label({
  children,
  tone = "paper",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={`${MONO_LABEL} ${tone === "dark" ? "text-chrome-muted" : "text-faint"}`}
    >
      {children}
    </div>
  );
}

export type Status =
  | "Published"
  | "Draft"
  | "Subscribed"
  | "Unsubscribed"
  | "Bounced"
  | "Planned";

// Statuses read as typed labels on a shelf tag: mono, upper case, a dot. The
// live ones (published, subscribed) are brass; the resting ones are muted; the
// cautionary ones amber.
const PILL: Record<Status, { bg: string; ink: string; dot: string }> = {
  Published: {
    bg: "bg-brass-soft",
    ink: "text-brass-ink",
    dot: "bg-brass-ink",
  },
  Subscribed: { bg: "bg-brass-soft", ink: "text-brass-ink", dot: "bg-ok" },
  Draft: { bg: "bg-chip", ink: "text-faint", dot: "bg-chip-dot" },
  Unsubscribed: { bg: "bg-chip", ink: "text-faint", dot: "bg-chip-dot" },
  Bounced: { bg: "bg-caution-soft", ink: "text-caution", dot: "bg-alert" },
  Planned: { bg: "bg-caution-soft", ink: "text-caution", dot: "bg-alert" },
};

export function Pill({ status }: { status: Status }) {
  const p = PILL[status];
  return (
    <span
      className={`inline-flex h-7 items-center gap-2 rounded-full px-3 ${p.bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      <span
        className={`font-meta text-[11px] font-medium tracking-[0.12em] uppercase ${p.ink}`}
      >
        {status}
      </span>
    </span>
  );
}

export function Avatar({
  initials,
  tone = "paper",
  size = 36,
}: {
  initials: string;
  tone?: Tone;
  size?: number;
}) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full font-meta text-[13px] font-medium ${
        tone === "dark"
          ? "bg-lifted text-brass"
          : "bg-brass-soft text-brass-ink"
      }`}
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}
