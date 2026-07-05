"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { MemberRow } from "./member-row";
import type { MemberRow as Member } from "@/server/users";

export function MembersTable({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      !q ||
      (m.name ?? "").toLowerCase().includes(q) ||
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
          aria-label="Search members by name or email"
          className="text-ink flex-1 border-none bg-transparent font-sans text-[15px] outline-none"
        />
      </div>

      <div className="border-line text-faint2 mt-4 hidden items-center px-1.5 pb-2.5 font-sans text-[10px] font-semibold tracking-[0.14em] uppercase sm:flex">
        <span className="flex-1">Member</span>
        <span className="w-[120px]">Subscription</span>
        <span className="w-[112px]">Role</span>
        <span className="w-[76px]">Joined</span>
        <span className="w-[30px]" />
      </div>

      {shown.map((m) => (
        <MemberRow key={m.id} member={m} currentUserId={currentUserId} />
      ))}

      {shown.length === 0 && (
        <p className="text-faint py-10 text-center font-sans text-sm">
          No members match “{query}”.
        </p>
      )}
    </div>
  );
}
