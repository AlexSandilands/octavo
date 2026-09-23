"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui";
import { MenuSelect } from "@/components/menu-select";
import type { MemberNameView } from "@/lib/comments";
import type { ComposerSetup } from "@/lib/discussion-thread";
import { initials } from "@/lib/initials";
import { AdminBadge } from "./admin-badge";

// "Posting as [name ▾]" beside the composer's buttons (issue #301): a compact
// menu of the account's names, a plain chip with only one. It shrinks to fit
// the row — the name truncates, and in a narrow box (a reply on a phone) the
// words "Posting as" give way, the menu's own label still saying them.
// Before the first post the composer asks for a name instead.
export function PostingAs({
  setup,
  nameId,
  onNameChange,
  menuSide,
  addName,
}: {
  setup: ComposerSetup;
  nameId: string | null;
  onNameChange: (nameId: string) => void;
  /** The main composer sits at the foot of the panel, so it opens upward. */
  menuSide: "top" | "bottom";
  /** Offer "Add a name" beside a single name (the main composer only). */
  addName: boolean;
}) {
  const { names } = setup;
  const current =
    names.find((n) => n.id === nameId) ??
    names.find((n) => n.id === setup.defaultNameId) ??
    names[0];
  if (!current) return null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 font-sans text-[13px]">
      <span
        aria-hidden={names.length > 1 ? true : undefined}
        className="text-faint flex-none @max-[20rem]:sr-only"
      >
        Posting as
      </span>
      {names.length === 1 ? (
        <>
          <span className="flex h-8 min-w-0 items-center">
            <NameLabel name={current} />
          </span>
          {addName && (
            <Link
              href="/profile"
              className="text-faint hover:text-accent inline-flex min-h-11 flex-none items-center px-1 underline underline-offset-4"
            >
              Add a name
            </Link>
          )}
        </>
      ) : (
        <div className="min-w-0">
          <MenuSelect
            label=""
            current={current.name}
            triggerLabel={`Posting as ${current.name}`}
            ariaLabel="Post under"
            size="compact"
            side={menuSide}
            className="max-w-[15rem]"
            menuClassName="left-0 right-auto! max-w-[min(20rem,calc(100vw-3rem))]"
            icon={
              <Avatar
                initials={initials(current.name)}
                src={current.avatarUrl}
                size="xs"
              />
            }
            value={current.id}
            onSelect={onNameChange}
            items={names.map((n) => ({
              key: n.id,
              value: n.id,
              content: <NameLabel name={n} />,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function NameLabel({ name }: { name: MemberNameView }) {
  return (
    <span className="text-ink flex min-w-0 items-center gap-1.5 font-medium">
      <Avatar initials={initials(name.name)} src={name.avatarUrl} size="xs" />
      <span className="truncate">{name.name}</span>
      {name.badge && <AdminBadge />}
    </span>
  );
}
