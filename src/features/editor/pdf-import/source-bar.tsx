"use client";

import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";

// The open file's row: its name, and the two ways out of it.
export function SourceBar({
  name,
  disabled,
  onReplace,
  onClose,
}: {
  name: string;
  disabled: boolean;
  onReplace: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border-line flex h-14 flex-none items-center gap-3 border-b pr-3 pl-5">
      <Icon name="doc" size={17} className="text-faint flex-none" />
      <span
        className="text-ink min-w-0 flex-1 truncate font-sans text-sm font-semibold"
        title={name}
      >
        {name}
      </span>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={onReplace}
      >
        Replace
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={onClose}
      >
        Close PDF
      </Button>
    </div>
  );
}
