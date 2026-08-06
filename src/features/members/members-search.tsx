"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

// The members search box. The query lives in the URL (?q=) and the filtering
// happens in the database, so a search sees every member — not just the page
// the table happens to be serving — and survives the refresh after a mutation.
// Typing stays local and debounced; each settled value replaces the URL
// (replace, not push, so keystrokes don't pile up in history) and drops ?page,
// because a new search starts from its own first page.
export function MembersSearch({ query }: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(query);
  // The query this box last navigated to. A `query` prop echoing our own
  // navigation must not clobber what's being typed; one arriving from outside
  // (back/forward, a shared link) resyncs the box.
  const sent = useRef(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query !== sent.current) {
      sent.current = query;
      setValue(query);
    }
  }, [query]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      if (q === sent.current) return;
      sent.current = q;
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    }, 250);
  };

  return (
    <div className="border-line text-faint2 flex h-11 items-center gap-2.5 rounded-lg border-[1.5px] bg-white px-3.5">
      <Icon name="search" size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name or email"
        aria-label="Search all members by name or email"
        className="text-ink flex-1 border-none bg-transparent font-sans text-[15px] outline-none"
      />
    </div>
  );
}
