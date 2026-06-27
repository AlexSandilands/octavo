"use client";

import type { Block } from "@/lib/blocks";

// Editable controls for one block. All editable fields are strings, so patches
// are a simple Record<string, string> the editor merges into the block.
export function BlockEdit({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Record<string, string>) => void;
}) {
  const field =
    "w-full border-none bg-transparent outline-none placeholder:text-faint2";

  switch (block.type) {
    case "heading":
      return (
        <div>
          <input
            value={block.kicker}
            onChange={(e) => onChange({ kicker: e.target.value })}
            placeholder="Kicker"
            className={`${field} text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase`}
          />
          <input
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Heading"
            className={`${field} text-ink mt-1.5 font-serif text-[26px] leading-tight`}
          />
        </div>
      );

    case "text":
      return (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Write your paragraph…"
          rows={4}
          className={`${field} text-body resize-none font-serif text-sm leading-[1.6]`}
        />
      );

    case "image":
      return (
        <div>
          <div className="bg-card flex flex-col items-center gap-1 rounded-md border-[1.5px] border-dashed border-[#c9c1b1] p-5 text-center">
            <span className="text-faint font-mono text-[10px]">
              IMAGE · upload coming in a later phase
            </span>
          </div>
          <input
            value={block.caption}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="Caption (optional)"
            className={`${field} text-muted mt-2 font-serif text-[13px] italic`}
          />
        </div>
      );

    case "sponsor":
      return (
        <div className="bg-tint rounded-md p-3">
          <div className="text-accent-soft font-sans text-[9px] font-semibold tracking-[0.18em] uppercase">
            Sponsor block
          </div>
          <input
            value={block.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Sponsor name"
            className={`${field} text-accent-ink mt-1 font-sans text-sm font-semibold`}
          />
          <input
            value={block.href ?? ""}
            onChange={(e) => onChange({ href: e.target.value })}
            placeholder="https://link (optional)"
            className={`${field} text-accent mt-1 font-sans text-[12px]`}
          />
        </div>
      );
  }
}
