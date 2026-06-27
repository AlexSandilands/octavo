"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { site } from "@/lib/site";
import type { IssueContent, Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import { BlockView, type Theme } from "@/features/blocks/block-view";
import { blockFlowStyle } from "@/features/blocks/layout";
import {
  PageFrame,
  ScaledPage,
  PAGE_W,
  PAGE_H,
} from "@/features/blocks/page-frame";

type TocEntry = { label: string; page: number };

function buildToc(pages: Page[]): TocEntry[] {
  const toc: TocEntry[] = [];
  pages.forEach((p, i) => {
    for (const b of p.blocks) {
      if (b.type === "heading" && b.title.trim()) {
        toc.push({ label: b.title, page: i + 1 });
      }
    }
  });
  return toc;
}

export function DesktopReader({
  content,
  issueNo,
  images,
}: {
  content: IssueContent;
  issueNo: number;
  images: ImageMap;
}) {
  const pages = content.pages;
  const toc = buildToc(pages);

  const [spread, setSpread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("Classic");

  // The page is a fixed PAGE_W×PAGE_H canvas; we only ever pick a scale that
  // fits the spread to the stage, then `zoom` multiplies it. Everything on the
  // page — type, images, spacing — scales together, so resizing never breaks the
  // layout. (Accessibility: the mobile reader reflows; here, zoom magnifies.)
  const stageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.7);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const availH = el.clientHeight - 72;
      const availW = el.clientWidth - 48;
      const s = Math.min(availH / PAGE_H, availW / (2 * PAGE_W));
      setFitScale(Math.max(0.4, s));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fitScale * zoom;

  const maxSpread = Math.max(0, Math.ceil(pages.length / 2) - 1);
  const left = pages[spread * 2];
  const right = pages[spread * 2 + 1];
  const label = `${spread * 2 + 1}–${spread * 2 + 2} / ${pages.length}`;
  const go = (page: number) => setSpread(Math.floor((page - 1) / 2));

  return (
    <div className="bg-stage relative flex h-screen overflow-hidden">
      <div className="absolute top-3.5 right-4 z-10 flex items-center gap-2">
        <span className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.18em] uppercase">
          Theme
        </span>
        <div className="bg-card border-hair flex rounded-full border p-[3px]">
          {(["Classic", "Modern"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-full px-3.5 py-[5px] font-sans text-xs font-semibold ${
                theme === t ? "bg-accent text-paper" : "text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {collapsed ? (
        <aside className="bg-card border-line flex w-[54px] flex-none flex-col items-center gap-4 border-r py-5">
          <Link
            href="/"
            title="Back to library"
            className="text-muted hover:text-accent"
          >
            <Icon name="chevronLeft" size={20} />
          </Link>
          <div className="bg-line h-px w-6" />
          <button
            onClick={() => setCollapsed(false)}
            className="text-accent"
            title="Expand contents"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="bg-line h-px w-6" />
          <span className="text-faint2 font-mono text-[10px] tracking-[0.1em] [writing-mode:vertical-rl]">
            CONTENTS
          </span>
        </aside>
      ) : (
        <aside className="bg-card border-line flex w-[248px] flex-none flex-col border-r py-5">
          <Link
            href="/"
            className="text-muted hover:text-accent mb-4 flex items-center gap-1.5 px-5 font-sans text-[13px] font-medium"
          >
            <Icon name="chevronLeft" size={16} />
            Library
          </Link>
          <div className="flex items-center justify-between px-5">
            <span className="text-accent font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
              Contents
            </span>
            <button
              onClick={() => setCollapsed(true)}
              className="text-muted"
              title="Collapse"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
          </div>
          <p className="text-faint px-5 pt-2 font-serif text-[13px] italic">
            {site.name} · No. {issueNo}
          </p>
          <div className="bg-line mx-5 my-4 h-px" />
          <nav className="flex-1 overflow-auto">
            {toc.length === 0 && (
              <p className="text-faint2 px-5 font-sans text-[13px]">
                Headings appear here.
              </p>
            )}
            {toc.map((t) => {
              const active = Math.floor((t.page - 1) / 2) === spread;
              return (
                <button
                  key={`${t.page}-${t.label}`}
                  onClick={() => go(t.page)}
                  className="flex w-full items-baseline justify-between gap-2.5 border-l-2 px-5 py-2.5 text-left"
                  style={{ borderColor: active ? "#1d4d3e" : "transparent" }}
                >
                  <span
                    className="font-serif text-[15px] leading-snug"
                    style={{ color: active ? "#1d4d3e" : "#2a2722" }}
                  >
                    {t.label}
                  </span>
                  <span className="text-faint2 font-mono text-[11px]">
                    {t.page}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <div ref={stageRef} className="relative flex-1 overflow-auto">
        <div className="flex min-h-full min-w-full items-center justify-center p-6">
          <div className="flex shadow-[0_18px_40px_rgba(40,36,28,0.18)]">
            <PageView
              page={left}
              side="left"
              theme={theme}
              scale={scale}
              issueNo={issueNo}
              pageNo={spread * 2 + 1}
              images={images}
            />
            <PageView
              page={right}
              side="right"
              theme={theme}
              scale={scale}
              issueNo={issueNo}
              pageNo={spread * 2 + 2}
              images={images}
            />
          </div>
        </div>
      </div>

      <div className="group absolute inset-x-0 bottom-0 flex justify-center px-4 pt-12 pb-4">
        <div className="flex items-center gap-1.5 rounded-full bg-[#211f1a] px-2.5 py-2 text-[#e7e2d6] opacity-20 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <CtrlBtn
            onClick={() => setSpread(Math.max(0, spread - 1))}
            title="Previous"
          >
            <Icon name="chevronLeft" size={18} strokeWidth={1.7} />
          </CtrlBtn>
          <span className="min-w-[76px] text-center font-sans text-[13px] text-[#cfc9bb]">
            {label}
          </span>
          <CtrlBtn
            onClick={() => setSpread(Math.min(maxSpread, spread + 1))}
            title="Next"
          >
            <Icon name="chevronRight" size={18} strokeWidth={1.7} />
          </CtrlBtn>
          <Divider />
          <CtrlBtn onClick={() => setCollapsed((c) => !c)} title="Contents">
            <Icon name="menu" size={18} />
          </CtrlBtn>
          <div className="flex items-center gap-2 pr-1 pl-1">
            <CtrlBtn onClick={() => setZoom(1)} title="Fit to screen">
              <Icon name="zoom" size={18} />
            </CtrlBtn>
            <input
              type="range"
              min={0.6}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              aria-label="Zoom page"
              title={`Zoom ${Math.round(zoom * 100)}%`}
              className="h-1 w-20 cursor-pointer"
              style={{ accentColor: "#9db8ac" }}
            />
          </div>
          <Divider />
          <CtrlBtn title="Download PDF">
            <Icon name="download" size={17} />
          </CtrlBtn>
          <CtrlBtn title="Reader mode">
            <Icon name="reader" size={17} />
          </CtrlBtn>
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full hover:bg-[#34312a]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-[22px] w-px bg-[#413d35]" />;
}

function PageView({
  page,
  side,
  theme,
  scale,
  issueNo,
  pageNo,
  images,
}: {
  page?: Page;
  side: "left" | "right";
  theme: Theme;
  scale: number;
  issueNo: number;
  pageNo: number;
  images: ImageMap;
}) {
  return (
    <ScaledPage scale={scale}>
      <PageFrame
        theme={theme}
        w={PAGE_W}
        h={PAGE_H}
        issueNo={issueNo}
        pageNo={page ? pageNo : undefined}
        side={side}
      >
        {page && (
          <div
            className={
              page.cover
                ? "flex min-h-full flex-col justify-center"
                : "relative flow-root"
            }
          >
            {page.blocks.map((b) => (
              <div key={b.id} style={blockFlowStyle(b, page.cover)}>
                <BlockView
                  block={b}
                  theme={theme}
                  images={images}
                  variant={page.cover ? "cover" : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </PageFrame>
    </ScaledPage>
  );
}
