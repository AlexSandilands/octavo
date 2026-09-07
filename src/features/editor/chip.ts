// The editor's block chrome: dark chips floating over the lit page, so the
// tools read as the room's furniture and never as part of the page. Shared by
// every block toolbar (editor-block.tsx and the controls it mounts).

/** A floating toolbar. Callers add placement (absolute, z, edges). */
export const CHIP_BAR =
  "border-hairline bg-raised text-chrome-text shadow-panel flex items-center gap-2.5 rounded-[8px] border px-2.5 py-1.5 whitespace-nowrap";

/** A labelled button on a chip: upload, edit montage, add a video… */
export const CHIP_BUTTON =
  "border-hairline bg-lifted text-chrome-text hover:border-brass hover:text-brass flex h-7 cursor-pointer items-center gap-1.5 rounded-[6px] border px-2.5 font-ui text-[12px] font-semibold transition-colors disabled:cursor-default disabled:opacity-60";

/** A segmented group's frame; each segment takes ON or OFF. */
export const CHIP_GROUP =
  "border-hairline flex overflow-hidden rounded-[6px] border";
export const CHIP_SEG_ON = "bg-brass text-ground";
export const CHIP_SEG_OFF =
  "bg-lifted text-chrome-muted hover:bg-chrome-soft hover:text-chrome-text";

/** The small typed label before a group ("Placement", "Alt"). */
export const CHIP_LABEL =
  "text-chrome-muted font-meta text-[9px] font-medium tracking-[0.14em] uppercase";

/** A text field on a chip. */
export const CHIP_INPUT =
  "border-hairline bg-ground text-chrome-text placeholder:text-chrome-muted rounded-[6px] border px-2 py-1 font-ui text-[12px] outline-none focus:border-brass";

export const CHIP_DIVIDER = "bg-hairline h-5 w-px";
