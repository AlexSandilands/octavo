import { Icon } from "@/components/icons";
import {
  FigureBadge,
  FigureFrame,
  MiniButton,
  MiniLink,
  MiniSelect,
} from "./guide-ui";

// A sketch of the Magazine details screen (/admin/magazine), mirroring its real
// two-pane layout: the settings column on the left — the Details group, whose
// wording fields, page-footer dropdowns and single Save button are one form —
// with the logo library under it, and the live page preview on the right.
// Built from the site's tokens; decorative (FigureFrame hides it from screen
// readers), so the numbered steps in section-magazine.tsx carry the meaning.

const FOOTER_CHOICES = [
  { label: "Mark size", value: "Medium" },
  { label: "Text size", value: "Medium" },
  { label: "Align", value: "Left" },
];

function GroupTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="border-lead flex items-center gap-2 border-t-2 pt-2">
      <FigureBadge n={n} />
      <span className="text-lead font-display text-[14px] leading-none font-semibold">
        {title}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-grey-soft block font-ui text-[8px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      <span className="border-lead text-lead bg-sheet mt-1 flex h-[22px] items-center truncate rounded-ui border px-2 font-ui text-[10px]">
        {value}
      </span>
    </div>
  );
}

// The settings column: one form ending in its own Save row, then the logo
// library — the order the real screen stacks them in.
function SettingsColumn() {
  return (
    <div className="bg-sheet flex min-w-0 flex-1 flex-col gap-4 p-3.5">
      <div>
        <GroupTitle n={1} title="Details" />
        <div className="mt-3 space-y-2.5">
          <Field label="Magazine name" value="Seaview Notes" />
          <Field label="Club or organisation" value="Seaview Sailing Club" />
          <Field label="Tagline" value="Stories from the harbour" />
        </div>

        <div className="border-hairline mt-3.5 border-t pt-3">
          <div className="flex items-center gap-2">
            <FigureBadge n={2} />
            <span className="text-lead font-display text-[13px] font-semibold">
              Page footer
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {FOOTER_CHOICES.map((c) => (
              <MiniSelect key={c.label}>
                {c.label}: {c.value}
              </MiniSelect>
            ))}
          </div>
        </div>

        <div className="border-lead mt-3.5 flex flex-wrap items-center gap-2 border-t-2 pt-3">
          <FigureBadge n={5} />
          <MiniButton primary>Save changes</MiniButton>
          <span className="text-grey-soft font-ui text-[9.5px]">
            Unsaved changes.
          </span>
        </div>
      </div>

      <div>
        <GroupTitle n={4} title="Logos" />
        <div className="mt-2.5">
          {["Club crest", "Wordmark"].map((name) => (
            <span
              key={name}
              className="border-hairline flex items-center gap-2 border-b py-1.5"
            >
              <span className="photo-fill border-lead h-5 w-5 flex-none border" />
              <span className="text-lead flex-1 truncate font-ui text-[10px] font-semibold">
                {name}
              </span>
              <MiniLink>Rename</MiniLink>
              <MiniLink>Delete</MiniLink>
            </span>
          ))}
        </div>
        <span className="text-grey-soft mt-2 block font-ui text-[9px] italic">
          Saves straight away
        </span>
      </div>
    </div>
  );
}

// The preview pane: its own two per-issue boxes, then one magazine page drawn
// down to its running footer, with the two parts the alignment setting puts at
// opposite margins called out beneath it.
function PreviewColumn() {
  return (
    <div className="flex w-[190px] flex-none flex-col items-center gap-2 sm:w-[200px] lg:w-[240px]">
      <div className="flex w-full flex-wrap items-center gap-1.5">
        <FigureBadge n={3} />
        {["Look: Classic", "Mark: Club crest"].map((c) => (
          <MiniSelect key={c}>{c}</MiniSelect>
        ))}
      </div>
      <div className="bg-sheet border-lead flex aspect-[640/900] w-full flex-col border p-3">
        <div className="text-grey-soft font-ui text-[7px] tracking-[0.12em] uppercase">
          Seaview Notes · No. 12
        </div>
        <div className="bg-hairline mt-2 h-[7px] w-3/4" />
        <div className="mt-2.5 space-y-1">
          <div className="bg-hairline h-[4px] w-full" />
          <div className="bg-hairline h-[4px] w-11/12" />
          <div className="bg-hairline h-[4px] w-full" />
        </div>
        <div className="photo-fill mt-2.5 aspect-[2/1] w-full" />
        <div className="mt-2.5 space-y-1">
          <div className="bg-hairline h-[4px] w-full" />
          <div className="bg-hairline h-[4px] w-full" />
          <div className="bg-hairline h-[4px] w-10/12" />
          <div className="bg-hairline h-[4px] w-full" />
          <div className="bg-hairline h-[4px] w-2/3" />
        </div>
        {/* The running footer: the mark and the club name as one lockup, the
            page number out at the opposite margin. */}
        <div className="text-grey-soft mt-auto flex items-center justify-between font-ui text-[8px] font-medium tracking-[0.1em] uppercase">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="photo-fill h-[13px] w-[13px] flex-none" />
            <span className="truncate">Seaview Sailing Club</span>
          </span>
          <span className="flex-none pl-2">7</span>
        </div>
      </div>
      {/* The alignment relationship, drawn: the lockup ranges left or centre or
          right, and the page number always takes the other margin. */}
      <div className="flex w-full items-start justify-between px-3">
        <span className="text-grey flex flex-col items-center gap-0.5">
          <Icon name="arrowUp" size={10} />
          <span className="font-ui text-[8px] leading-tight">
            Lockup — Align: Left
          </span>
        </span>
        <span className="text-grey flex flex-col items-center gap-0.5">
          <Icon name="arrowUp" size={10} />
          <span className="font-ui text-[8px] leading-tight">Page number</span>
        </span>
      </div>
    </div>
  );
}

export function MagazineFigure() {
  return (
    <FigureFrame caption="The Magazine screen: the settings on the left, and on the right a real page showing what they do — before you save. The numbers match the steps below.">
      {/* Held to roughly the real screen's proportions rather than stretched
          across the figure's full bleed: the form pane a little wider than the
          preview, as the split opens. */}
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-0">
        <SettingsColumn />
        {/* The draggable rail the real screen puts between the two panes. */}
        <div className="hidden w-8 flex-none self-stretch sm:flex sm:justify-center">
          <span className="bg-hairline relative w-px">
            <span className="border-lead bg-sheet absolute top-1/2 left-1/2 h-8 w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-ui border" />
          </span>
        </div>
        <PreviewColumn />
      </div>
    </FigureFrame>
  );
}
