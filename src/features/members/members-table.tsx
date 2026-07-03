"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Avatar, Pill } from "@/components/ui";
import { initials } from "@/lib/initials";
import type { Member } from "@/lib/sample-members";

export function MembersTable({ members }: { members: Member[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q),
  );

  return (
    <div className="mt-5">
      <div className="border-line text-faint2 flex h-11 items-center gap-2.5 rounded-lg border-[1.5px] bg-white px-3.5">
        <Icon name="search" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="text-ink flex-1 border-none bg-transparent font-sans text-[15px] outline-none"
        />
      </div>

      <div className="border-line text-faint2 mt-4 flex items-center border-b px-1.5 pb-2.5 font-sans text-[10px] font-semibold tracking-[0.14em] uppercase">
        <span className="flex-1">Member</span>
        <span className="w-[130px]">Status</span>
        <span className="w-[90px]">Joined</span>
        <span className="w-[30px]" />
      </div>

      {shown.map((m) => (
        <div
          key={m.email}
          className="border-line-soft flex items-center border-b px-1.5 py-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar initials={initials(m.name)} />
            <div className="min-w-0">
              <div className="text-ink font-sans text-[15px] font-semibold">
                {m.name}
              </div>
              <div className="text-faint truncate font-sans text-[13px]">
                {m.email}
              </div>
            </div>
          </div>
          <div className="w-[130px]">
            <Pill status={m.status} />
          </div>
          <div className="text-faint w-[90px] font-sans text-[13px]">
            {m.joined}
          </div>
          <button
            className="text-faint2 hover:text-warn flex w-[30px] justify-end"
            title="Remove member"
            aria-label={`Remove ${m.name}`}
          >
            <Icon name="close" size={20} strokeWidth={1.7} />
          </button>
        </div>
      ))}

      {shown.length === 0 && (
        <p className="text-faint py-10 text-center font-sans text-sm">
          No members match “{query}”.
        </p>
      )}
    </div>
  );
}
