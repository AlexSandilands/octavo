"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { ADMIN_LIST_QUERY_MAX } from "@/lib/list-query";
import { useListUrl } from "@/components/use-list-url";

// The search box for a list — the admin lists and the members' archive alike.
// The query lives in the URL (?q=) and the filtering happens in the database,
// so a search sees every row — not just the page the list happens to be
// serving — and survives the refresh after a mutation. Typing stays local and
// debounced; each settled value replaces the URL (replace, not push, so
// keystrokes don't pile up in history) and drops ?page, because a new search
// starts from its own first page. A clear × empties it in one press.
export function ListSearch({
  query,
  placeholder,
  ariaLabel,
  maxLength = ADMIN_LIST_QUERY_MAX,
}: {
  query: string;
  placeholder: string;
  /** Names the box for screen readers, e.g. "Search all issues by title". */
  ariaLabel: string;
  /** The page schema truncates ?q= to the same bound, so nothing this box can
   * produce is ever thrown away server-side. */
  maxLength?: number;
}) {
  const go = useListUrl();
  const [value, setValue] = useState(query);
  // The query this box last navigated to. A `query` prop echoing our own
  // navigation must not clobber what's being typed; one arriving from outside
  // (back/forward, a shared link) resyncs the box.
  const sent = useRef(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const settle = (next: string, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      if (q === sent.current) return;
      sent.current = q;
      // Keep whatever filters are on; a new search starts from its own page 1.
      go({ q: q || null, page: null }, "replace");
    }, delay);
  };

  const onChange = (next: string) => {
    setValue(next);
    settle(next, 250);
  };

  const clear = () => {
    setValue("");
    settle("", 0);
    inputRef.current?.focus();
  };

  return (
    // A <label> rather than a <div>: the input's own box is one text line, so
    // on a phone the whole 48px field has to be what focuses it.
    <label className="boxed-field border-edge text-fg-muted bg-surface flex h-12 items-center gap-3 rounded-full border-[1.5px] pr-1.5 pl-4">
      <Icon name="search" size={20} strokeWidth={2} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="text-fg placeholder:text-fg-faint min-w-0 flex-1 self-stretch border-none bg-transparent font-ui text-[17px]"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          title="Clear search"
          className="text-fg-muted hover:bg-primary-wash hover:text-primary flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full transition-colors"
        >
          <Icon name="close" size={18} strokeWidth={2} />
        </button>
      )}
    </label>
  );
}
