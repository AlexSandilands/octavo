"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { SiteSettings } from "@/lib/branding";
import type { LogoListItem } from "@/lib/logos";
import {
  enabledThemes,
  getTheme,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";
import { usePrePaintEffect } from "./use-pre-paint-effect";

// The live preview beside the settings form: one real magazine page, drawn by
// the same PageFrame + PageFooter the reader, the editor and the PDF use, from
// the settings currently in the form rather than the ones in the database. That
// is the point of it — the footer's mark size, type size and alignment are hard
// to picture from three dropdowns, and the classic theme's ruled frame is the
// fiddly case (the lockup has to stay inside its inner hairline at every size).
//
// Its own two controls are not settings: the layout theme is chosen per issue
// and the mark per issue, so both are here purely to let the owner look at the
// combination they care about.

// Above `xl` the preview fills whatever width the owner has dragged its column
// to (see resizable-split.tsx). Below it, the panes stack full-width, where a
// page rendered edge to edge would dwarf the form it belongs to — so the box is
// capped there at the width this preview has always been.
const STACKED_MAX_W = 340;

// Tailwind's `xl`: the breakpoint the split layout turns on at.
const WIDE_QUERY = "(min-width: 80rem)";

// Room the column's own furniture takes above and below the page — the control
// row, the caption, and the gaps between them. Subtracted from the viewport so
// the sticky preview always fits on screen whole.
const COLUMN_CHROME_H = 150;

/** The page's on-screen size, tracked from its own container rather than a
 *  constant: the column is resizable, so the scale has to follow it. */
function usePreviewScale() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(STACKED_MAX_W);
  const [maxHeight, setMaxHeight] = useState(Infinity);

  usePrePaintEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // Up front, rather than waiting for the observer's first delivery — that
    // arrives after a paint has already gone out.
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Above xl the preview is sticky, so a page taller than the viewport puts its
  // own footer — the thing these settings are about — permanently below the
  // fold with no way to scroll to it. Cap the height there. Below xl the column
  // scrolls normally, so height is not a constraint and clamping by it would
  // shrink the stacked preview on a short window for no reason.
  usePrePaintEffect(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const sync = () =>
      setMaxHeight(
        media.matches
          ? Math.max(240, window.innerHeight - COLUMN_CHROME_H)
          : Infinity,
      );
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  // Never above 1: a magazine page blown up past its real size would misrepresent
  // the type, which is the whole point of looking at it.
  const scale = Math.min(1, width / PAGE_W, maxHeight / PAGE_H);
  return { boxRef, scale };
}

export function SettingsPreview({
  settings,
  logos,
}: {
  /** The effective settings for the form's current, possibly unsaved, state. */
  settings: SiteSettings;
  logos: LogoListItem[];
}) {
  const { boxRef, scale } = usePreviewScale();
  const themes = enabledThemes();
  const [themeId, setThemeId] = useState<LayoutThemeId>(
    themes[0]?.id ?? "classic",
  );
  // Defaults to the first mark in the library: an owner opening this page wants
  // to see the lockup. "No mark" is remembered only when chosen — a null that
  // merely means "the library was empty" must not stick once it isn't.
  const [logoId, setLogoId] = useState<string | null>(logos[0]?.id ?? null);
  const [choseNone, setChoseNone] = useState(false);
  const pickLogo = (id: string | null) => {
    setLogoId(id);
    setChoseNone(id === null);
  };
  // The library is edited beside this preview and router.refresh() keeps client
  // state, so the mount-time default above never re-runs. Follow the list
  // (adjusted during render): adopt the first mark added to an empty library
  // (the owner adds one precisely to see the lockup), and fall off a mark that
  // has been deleted.
  const kept =
    logoId !== null && logos.some((l) => l.id === logoId)
      ? logoId
      : (logos[0]?.id ?? null);
  if (!choseNone && logoId !== kept) setLogoId(kept);
  const logo = logos.find((l) => l.id === logoId)?.image ?? null;

  const themeItems: MenuSelectItem<LayoutThemeId>[] = themes.map((t) => ({
    key: t.id,
    value: t.id,
    content: t.name,
  }));
  const logoItems: MenuSelectItem<string | null>[] = [
    { key: "none", value: null, content: "No mark" },
    ...logos.map((l) => ({
      key: l.id,
      value: l.id as string | null,
      content: l.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <MenuSelect
          label="Theme"
          current={getTheme(themeId).name}
          ariaLabel="Preview layout theme"
          items={themeItems}
          value={themeId}
          onSelect={setThemeId}
        />
        {logos.length > 0 && (
          <MenuSelect
            label="Mark"
            current={logos.find((l) => l.id === logoId)?.name ?? "No mark"}
            ariaLabel="Preview footer mark"
            items={logoItems}
            value={logoId}
            onSelect={pickLogo}
          />
        )}
      </div>

      {/* The measured box: full width of its column above xl, capped below it.
          Inert — a picture of a page, not a page. Nothing inside is reachable
          by keyboard or pointer, so it never competes with the form for focus. */}
      <div ref={boxRef} className="max-w-[340px] xl:max-w-none">
        <div
          aria-hidden="true"
          className="pointer-events-none w-fit overflow-hidden rounded-[3px] shadow-[0_10px_30px_rgba(40,36,28,0.14)] select-none"
        >
          <ScaledPage scale={scale}>
            <PageFrame
              theme={getTheme(themeId)}
              w={PAGE_W}
              h={PAGE_H}
              issueNo={12}
              pageNo={7}
              side="right"
              logo={logo}
              settings={settings}
            >
              <PlaceholderPage themeId={themeId} />
            </PageFrame>
          </ScaledPage>
        </div>
      </div>

      {/* Held to a readable measure, and to the stacked layout's own width
          below xl so that layout is untouched by the split. */}
      <p className="text-faint2 max-w-[340px] font-sans text-[12px] leading-relaxed xl:max-w-[420px]">
        {scale >= 1
          ? "A page at its real size, with stand-in words."
          : `A page at ${Math.round(scale * 100)}% of its real size, with stand-in words.`}{" "}
        {logos.length === 0 && (
          <>
            No marks in the library yet —{" "}
            <Link
              href="#logos"
              className="text-accent font-medium underline underline-offset-2"
            >
              add one
            </Link>{" "}
            to see the footer lockup.
          </>
        )}
      </p>
    </div>
  );
}

// Stand-in body copy so the page has the weight of a real one behind the
// chrome. Deliberately not the block renderer: the preview is about the frame
// and the footer, and a fake IssueContent would drag the whole editor pipeline
// into this bundle for a heading and three paragraphs.
function PlaceholderPage({ themeId }: { themeId: LayoutThemeId }) {
  const heading = getTheme(themeId).heading.main;
  return (
    <>
      <div className={heading.wrapper}>
        <div className={getTheme(themeId).heading.kicker}>From the archive</div>
        <div className={heading.title}>A morning on the water</div>
        {heading.rule?.()}
      </div>
      <div className="text-body mt-5 space-y-3 font-serif text-[13px] leading-[1.62]">
        <p>
          The tide turned a little after six and the fleet went out with it,
          eleven boats strung along the channel in a light southerly that
          promised more than it delivered.
        </p>
        <p>
          By nine the wind had swung and stiffened, and the run home was the
          sort that gets retold at the clubhouse with the numbers gently
          improved. Nobody minded. The season had started.
        </p>
        <p>
          What follows is the log as it was kept, with the weather notes left in
          — they explain more about the day than any account of the racing
          could.
        </p>
      </div>
    </>
  );
}
