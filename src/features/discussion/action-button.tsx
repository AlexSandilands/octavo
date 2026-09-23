"use client";

// One of the quiet text buttons under a comment (issues #301, #302): 44px
// tall and wide, named for the comment it acts on.
export function ActionButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-faint hover:text-accent hover:bg-accent-wash inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-2 font-sans text-[14px] font-semibold transition-colors"
    >
      {children}
    </button>
  );
}
