import type { ReactNode } from "react";

// A rounded bar floating over the foot of the content pane — the admin lists'
// bulk actions once something is selected. Fixed to the viewport, centred on
// the pane (the sidebar's width is added from md), and held above the phone
// tab bar. Rendered only while it has something to say.
export function FloatingBar({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3 md:left-[240px]"
      style={{
        bottom:
          "calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 12px)",
      }}
    >
      <div className="bg-surface border-hairline shadow-float pointer-events-auto flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-card border px-3 py-2 md:rounded-full md:px-4">
        {children}
      </div>
    </div>
  );
}
