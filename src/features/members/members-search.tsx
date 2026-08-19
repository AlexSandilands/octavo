"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { MEMBERS_QUERY_MAX } from "./query-limit";
import { useListUrl } from "@/components/use-list-url";

// The members search box. The query lives in the URL (?q=) and the filtering
// happens in the database, so a search sees every member — not just the page
// the table happens to be serving — and survives the refresh after a mutation.
// Typing stays local and debounced; each settled value replaces the URL
// (replace, not push, so keystrokes don't pile up in history) and drops ?page,
// because a new search starts from its own first page.
export function MembersSearch({ query }: { query: string }) {
  const go = useListUrl();
  const [value, setValue] = useState(query);
  // The query this box last navigated to. A `query` prop echoing our own
  // navigation must not clobber what's being typed; one arriving from outside
  // (back/forward, a shared link) resyncs the box.
  const sent = useRef(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query !== sent.current) {
      // An outside navigation also cancels any armed debounce: a timer left
      // ticking across Back would fire afterwards, clobber the entry the
      // admin just returned to, and leave the box desynced from the URL.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
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
      // Keep the status filter; a new search starts from its own first page.
      go({ q: q || null, page: null }, "replace");
    }, 250);
  };

  return (
    <div className="boxed-field border-line text-faint2 flex h-11 items-center gap-2.5 rounded-lg border-[1.5px] bg-white px-3.5">
      <Icon name="search" size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // The page schema truncates ?q= to the same bound, so nothing this
        // box can produce is ever thrown away server-side.
        maxLength={MEMBERS_QUERY_MAX}
        placeholder="Search by name or email"
        aria-label="Search all members by name or email"
        className="text-ink flex-1 border-none bg-transparent font-sans text-[15px]"
      />
    </div>
  );
}
