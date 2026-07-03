"use client";

import { Button } from "@/components/ui";

// The two entry points for growing the list. Kept as its own component so the
// page header stays thin and both it and the empty state can trigger the same
// dialogs.
export function MembersToolbar({
  onImport,
  onAdd,
}: {
  onImport: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Button variant="secondary" icon="upload" onClick={onImport}>
        Import CSV
      </Button>
      <Button icon="plus" onClick={onAdd}>
        Add member
      </Button>
    </div>
  );
}
