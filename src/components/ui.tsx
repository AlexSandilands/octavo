import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { site } from "@/lib/site";

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-serif text-ink"
      style={{ fontSize: size, fontWeight: 500, letterSpacing: ".02em" }}
    >
      {site.name}
    </span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-sans text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-sans text-[11px] font-semibold tracking-[0.2em] text-faint uppercase">
      {children}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: IconName;
  variant?: "primary" | "secondary";
  full?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
};

export function Button({
  children,
  href,
  icon,
  variant = "primary",
  full = false,
  onClick,
  type = "button",
}: ButtonProps) {
  const base = `${full ? "flex w-full" : "inline-flex"} h-12 items-center justify-center gap-2 rounded-lg px-5 font-sans text-[15px] font-semibold transition-colors`;
  const styles =
    variant === "primary"
      ? "bg-accent text-paper hover:bg-accent-strong shadow-[0_2px_8px_rgba(29,77,62,0.25)]"
      : "border-[1.5px] border-hair bg-white text-ink hover:bg-paper";
  const cls = `${base} ${styles}`;
  const inner = (
    <>
      {children}
      {icon && <Icon name={icon} size={17} strokeWidth={1.8} />}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export type Status =
  | "Published"
  | "Draft"
  | "Subscribed"
  | "Unsubscribed"
  | "Bounced"
  | "Planned";

const PILL: Record<Status, { bg: string; ink: string; dot: string }> = {
  Published: { bg: "bg-tint", ink: "text-accent", dot: "bg-accent" },
  Subscribed: { bg: "bg-tint", ink: "text-accent", dot: "bg-[#2f8f6b]" },
  Draft: { bg: "bg-[#efeae0]", ink: "text-faint", dot: "bg-[#b8b1a2]" },
  Unsubscribed: { bg: "bg-[#efeae0]", ink: "text-faint", dot: "bg-[#b8b1a2]" },
  Bounced: { bg: "bg-warn-soft", ink: "text-warn", dot: "bg-[#c8923f]" },
  Planned: { bg: "bg-warn-soft", ink: "text-warn", dot: "bg-[#c8923f]" },
};

export function Pill({ status }: { status: Status }) {
  const p = PILL[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${p.bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      <span className={`font-sans text-xs font-semibold ${p.ink}`}>
        {status}
      </span>
    </span>
  );
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <span className="bg-tint text-accent flex h-9 w-9 flex-none items-center justify-center rounded-full font-sans text-[13px] font-semibold">
      {initials}
    </span>
  );
}

// The striped magazine cover used for thumbnails and heroes.
export function Cover({
  no,
  title,
  className = "",
  size = "md",
}: {
  no: number;
  title: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const pad = size === "lg" ? "p-5" : "p-4";
  const titleSize =
    size === "lg" ? "text-4xl" : size === "md" ? "text-3xl" : "text-xl";
  return (
    <div
      className={`photo-fill-green flex flex-col justify-between rounded-[4px] ${pad} ${className}`}
    >
      <div className="text-cream font-serif text-xs tracking-[0.1em]">
        {site.name} · No. {no}
      </div>
      <div className={`text-paper font-serif leading-[0.98] ${titleSize}`}>
        {title}
      </div>
    </div>
  );
}

export { Icon };
