"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useListUrl } from "@/components/use-list-url";
import { ARCHIVE_QUERY_MAX } from "./archive-limits";

// The archive's title search. Same contract as the members list's box: the
// query lives in the URL (?q=) and the filtering happens in the database, so a
// search sees every issue rather than the page being served, and survives a
// refresh or a shared link. Typing stays local and debounced; each settled
// value replaces the URL (so keystrokes don't pile up in history) and drops
// ?page, because a new search starts from its own first page.
export function ArchiveSearch({ query }: { query: string }) {
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
      // ticking across Back would fire afterwards and clobber the entry just
      // returned to.
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
      // Keep the year filter; a new search starts from its own first page.
      go({ q: q || null, page: null }, "replace");
    }, 250);
  };

  return (
    // A <label> rather than a <div>: the input's own box is one text line, so
    // on a phone the whole 44px field has to be what focuses it.
    <label className="boxed-field border-line text-faint2 flex h-11 items-center gap-2.5 rounded-lg border-[1.5px] bg-white px-3.5">
      <Icon name="search" size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // The page schema truncates ?q= to the same bound, so nothing this box
        // can produce is ever thrown away server-side.
        maxLength={ARCHIVE_QUERY_MAX}
        placeholder="Search issues by title"
        aria-label="Search every issue by title"
        className="text-ink flex-1 self-stretch border-none bg-transparent font-sans text-[15px]"
      />
    </label>
  );
}
