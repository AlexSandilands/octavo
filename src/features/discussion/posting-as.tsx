"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui";
import { MenuSelect } from "@/components/menu-select";
import type { MemberNameView } from "@/lib/comments";
import type { ComposerSetup } from "@/lib/discussion-thread";
import { initials } from "@/lib/initials";
import { NameField } from "@/features/profile/name-field";
import { AdminBadge } from "./admin-badge";

// "Posting as [name ▾]" under the composer (issue #301): a menu of the
// account's names, plain text with only one, and — before the first post — a
// field for the name other members will see.
export function PostingAs({
  id,
  setup,
  nameId,
  onNameChange,
  newName,
  onNewNameChange,
  newNameError,
  menuSide,
}: {
  id: string;
  setup: ComposerSetup;
  nameId: string | null;
  onNameChange: (nameId: string) => void;
  newName: string;
  onNewNameChange: (value: string) => void;
  newNameError: string | null;
  /** The main composer sits at the foot of the panel, so it opens upward. */
  menuSide: "top" | "bottom";
}) {
  const { names } = setup;
  if (names.length === 0) {
    return (
      <NameField
        id={`${id}-name`}
        label="Choose the name other members will see"
        value={newName}
        error={newNameError}
        onChange={onNewNameChange}
      />
    );
  }

  const current =
    names.find((n) => n.id === nameId) ??
    names.find((n) => n.id === setup.defaultNameId) ??
    names[0]!;
  if (names.length === 1) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[14px]">
        <span className="text-muted flex items-center gap-2">
          Posting as
          <NameLabel name={current} />
        </span>
        <Link
          href="/profile"
          className="text-faint hover:text-accent inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Add a name
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 font-sans text-[14px]">
      <span className="text-muted">Posting as</span>
      <MenuSelect
        label=""
        current={current.name}
        triggerLabel={`Posting as ${current.name}`}
        ariaLabel="Post under"
        size="md"
        side={menuSide}
        className="max-w-[16rem]"
        value={current.id}
        onSelect={onNameChange}
        items={names.map((n) => ({
          key: n.id,
          value: n.id,
          content: <NameLabel name={n} />,
        }))}
      />
    </div>
  );
}

function NameLabel({ name }: { name: MemberNameView }) {
  return (
    <span className="text-ink flex min-w-0 items-center gap-2 font-medium">
      <Avatar initials={initials(name.name)} src={name.avatarUrl} size="sm" />
      <span className="truncate">{name.name}</span>
      {name.badge && <AdminBadge />}
    </span>
  );
}
