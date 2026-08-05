import { Icon } from "@/components/icons";
import { FigureBadge, FigureFrame } from "./guide-ui";

// A sketch of the Magazine details screen (/admin/magazine), mirroring its real
// two-pane layout: the settings column on the left — the Details card, whose
// wording fields, page-footer dropdowns and single Save button are one form —
// with the logo library under it, and the live page preview on the right.
// Built from the site's tokens; decorative (FigureFrame hides it from screen
// readers), so the numbered steps in section-magazine.tsx carry the meaning.

const FOOTER_CHOICES = [
  { label: "Mark size", value: "Medium" },
  { label: "Text size", value: "Medium" },
  { label: "Align", value: "Left" },
];

function CardTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <FigureBadge n={n} />
      <span className="text-ink font-serif text-[13px] leading-none">
        {title}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-faint block font-sans text-[8px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      <span className="border-hair text-ink mt-1 flex h-[22px] items-center truncate rounded-[5px] border bg-white px-2 font-sans text-[10px]">
        {value}
      </span>
    </div>
  );
}

// The settings column: one form card ending in its own Save row, then the logo
// library — the order the real screen stacks them in.
function SettingsColumn() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="border-line bg-paper rounded-lg border p-3.5">
        <CardTitle n={1} title="Details" />
        <div className="mt-3 space-y-2.5">
          <Field label="Magazine name" value="Seaview Notes" />
          <Field label="Club or organisation" value="Seaview Sailing Club" />
          <Field label="Tagline" value="Stories from the harbour" />
        </div>

        <div className="border-line-soft mt-3.5 border-t pt-3">
          <CardTitle n={2} title="Page footer" />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {FOOTER_CHOICES.map((c) => (
              <span
                key={c.label}
                className="border-hair-warm text-ink flex h-[23px] items-center gap-1 rounded-[5px] border bg-white px-2 font-sans text-[9.5px] font-medium"
              >
                {c.label}: {c.value}
                <Icon name="chevronDown" size={9} strokeWidth={2} />
              </span>
            ))}
          </div>
        </div>

        <div className="border-line-soft mt-3.5 flex flex-wrap items-center gap-2 border-t pt-3">
          <FigureBadge n={5} />
          <span className="bg-accent text-paper rounded-md px-2.5 py-1.5 font-sans text-[10.5px] font-semibold">
            Save changes
          </span>
          <span className="text-faint font-sans text-[9.5px]">
            Unsaved changes.
          </span>
        </div>
      </div>

      <div className="border-line bg-paper rounded-lg border p-3.5">
        <CardTitle n={4} title="Logos" />
        <div className="mt-2.5 space-y-1.5">
          {["Club crest", "Wordmark"].map((name) => (
            <span
              key={name}
              className="border-line-soft flex items-center gap-2 border-b pb-1.5 last:border-b-0"
            >
              <span className="photo-fill h-5 w-5 flex-none rounded-[3px]" />
              <span className="text-ink flex-1 truncate font-sans text-[10px] font-semibold">
                {name}
              </span>
              <Icon name="pencil" size={11} className="text-faint2" />
              <Icon name="trash" size={11} className="text-faint2" />
            </span>
          ))}
        </div>
        <span className="bg-tint text-accent mt-2.5 inline-block rounded-full px-2 py-0.5 font-sans text-[9px] font-semibold">
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
    // Narrower between the breakpoints, where the admin sidebar has taken its
    // room out of the guide column and the form pane would otherwise be the
    // smaller of the two.
    <div className="flex w-[190px] flex-none flex-col items-center gap-2 sm:w-[200px] lg:w-[240px]">
      <div className="flex w-full flex-wrap items-center gap-1.5">
        <FigureBadge n={3} />
        {["Theme: Classic", "Mark: Club crest"].map((c) => (
          <span
            key={c}
            className="border-hair-warm text-ink flex h-[21px] items-center gap-1 rounded-[5px] border bg-white px-1.5 font-sans text-[9px] font-medium"
          >
            {c}
            <Icon name="chevronDown" size={8} strokeWidth={2} />
          </span>
        ))}
      </div>
      <div className="bg-page flex aspect-[640/900] w-full flex-col rounded-[2px] p-3 shadow-[0_2px_8px_rgba(20,32,28,0.18)]">
        <div className="text-faint2 font-sans text-[7px] tracking-[0.12em] uppercase">
          Seaview Notes · No. 12
        </div>
        <div className="bg-rule mt-2 h-[7px] w-3/4 rounded-xs" />
        <div className="mt-2.5 space-y-1">
          <div className="bg-line h-[4px] w-full rounded-xs" />
          <div className="bg-line h-[4px] w-11/12 rounded-xs" />
          <div className="bg-line h-[4px] w-full rounded-xs" />
        </div>
        <div className="photo-fill mt-2.5 aspect-[2/1] w-full rounded-[2px]" />
        <div className="mt-2.5 space-y-1">
          <div className="bg-line h-[4px] w-full rounded-xs" />
          <div className="bg-line h-[4px] w-full rounded-xs" />
          <div className="bg-line h-[4px] w-10/12 rounded-xs" />
          <div className="bg-line h-[4px] w-full rounded-xs" />
          <div className="bg-line h-[4px] w-2/3 rounded-xs" />
        </div>
        {/* The running footer: the mark and the club name as one lockup, the
            page number out at the opposite margin. */}
        <div className="text-faint2 mt-auto flex items-center justify-between font-sans text-[8px] font-medium tracking-[0.1em] uppercase">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="photo-fill h-[13px] w-[13px] flex-none rounded-[2px]" />
            <span className="truncate">Seaview Sailing Club</span>
          </span>
          <span className="flex-none pl-2">7</span>
        </div>
      </div>
      {/* The alignment relationship, drawn: the lockup ranges left or centre or
          right, and the page number always takes the other margin. */}
      <div className="flex w-full items-start justify-between px-3">
        <span className="text-faint2 flex flex-col items-center gap-0.5">
          <Icon name="arrowUp" size={10} />
          <span className="font-sans text-[8px] leading-tight">
            Lockup — Align: Left
          </span>
        </span>
        <span className="text-faint2 flex flex-col items-center gap-0.5">
          <Icon name="arrowUp" size={10} />
          <span className="font-sans text-[8px] leading-tight">
            Page number
          </span>
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
      <div className="mx-auto flex max-w-[620px] flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-0">
        <SettingsColumn />
        {/* The draggable rail the real screen puts between the two panes. */}
        <div className="hidden w-8 flex-none self-stretch sm:flex sm:justify-center">
          <span className="bg-line relative w-px">
            <span className="border-hair-warm absolute top-1/2 left-1/2 h-8 w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-white" />
          </span>
        </div>
        <PreviewColumn />
      </div>
    </FigureFrame>
  );
}
