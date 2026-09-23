"use client";

import { useEffect, useId, useRef } from "react";
import { Avatar, Button } from "@/components/ui";
import { initials } from "@/lib/initials";
import type { ProfileName } from "@/server/member-profile";
import { NamePanel } from "./name-panel";
import type { Announce, NameRules } from "./names-shared";

// One posting name, collapsed to avatar · name · Edit. Edit opens its panel
// beneath (one at a time, the section decides); Done, Cancel or Escape close
// it and put focus back on this row's button.
export function NameRow({
  name,
  open,
  isAdmin,
  isOnly,
  shared,
  rules,
  announce,
  onOpen,
  onClose,
  onShared,
  onRemoved,
}: {
  name: ProfileName;
  open: boolean;
  isAdmin: boolean;
  isOnly: boolean;
  shared: boolean;
  rules: NameRules;
  announce: Announce;
  onOpen: () => void;
  onClose: () => void;
  onShared: (nameId: string, shared: boolean) => void;
  onRemoved: () => void;
}) {
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  // Set when this row closes itself; another row opening leaves focus alone.
  const refocus = useRef(false);
  const meta = [
    isAdmin && name.badge ? "Admin badge shown" : null,
    shared ? "Shared with another member" : null,
  ].filter(Boolean);

  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      toggle.current?.focus();
    }
  }, [open]);

  const close = () => {
    refocus.current = true;
    onClose();
  };

  return (
    <li className="border-line-soft border-t py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        <Avatar initials={initials(name.name)} src={name.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate font-sans text-[17px] font-semibold">
            {name.name}
          </p>
          {meta.length > 0 && (
            <p className="text-muted truncate font-sans text-[13px]">
              {meta.join(" · ")}
            </p>
          )}
        </div>
        <Button
          ref={toggle}
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Done with ${name.name}` : `Edit ${name.name}`}
          onClick={open ? close : onOpen}
          className="min-h-11 flex-none"
        >
          {open ? "Done" : "Edit"}
        </Button>
      </div>
      <div
        id={panelId}
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
      >
        {open && (
          <NamePanel
            name={name}
            isAdmin={isAdmin}
            isOnly={isOnly}
            shared={shared}
            rules={rules}
            announce={announce}
            onShared={onShared}
            onClose={close}
            onRemoved={onRemoved}
          />
        )}
      </div>
    </li>
  );
}
