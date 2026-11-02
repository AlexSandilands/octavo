// Flex centres the label's line box, not its ink; these drop each family's
// cap height onto the button's centre-line (#214). Measured at 12px.
export const CAP_NUDGE = {
  sans: "translate-y-[1.7px]",
  serif: "translate-y-[2.55px]",
} as const;
