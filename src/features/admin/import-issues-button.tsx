"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { ImportIssuesDialog } from "./import-issues-dialog";

// The dialog, and the unzip it loads, arrive only once it is asked for.
export function ImportIssuesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        icon="upload"
        iconPosition="left"
        className={className}
        onClick={() => setOpen(true)}
      >
        Import issues
      </Button>
      {open && <ImportIssuesDialog onClose={() => setOpen(false)} />}
    </>
  );
}
