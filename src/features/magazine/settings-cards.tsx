"use client";

import type { ReactNode } from "react";
import {
  FOOTER_ALIGNS,
  FOOTER_ALIGN_LABELS,
  MARK_SIZES,
  MARK_SIZE_LABELS,
  TEXT_SIZES,
  TEXT_SIZE_LABELS,
  type FooterAlign,
  type MarkSize,
  type SiteSettings,
  type TextSize,
} from "@/lib/branding";
import { SettingsCard } from "@/components/settings-card";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";
import type { SettingsForm } from "./magazine-settings";

// The settings form card on /admin/magazine. One card, because it is one form
// with one Save: the naming fields, then the page-footer controls as a titled
// section, then the save row (passed in as `footer`) closing the card — so the
// button visibly belongs to everything above it and nothing floats between
// cards. Presentation only — every value and setter comes from
// MagazineSettings, which owns the form state so the preview beside it can
// render the same unsaved edits.

export function SettingsFormCard({
  form,
  defaults,
  onChange,
  footer,
}: {
  form: SettingsForm;
  /** The deployment's own values, shown as the placeholder when a field is
   *  empty so the owner can see what clearing it falls back to. */
  defaults: SiteSettings;
  onChange: (patch: Partial<SettingsForm>) => void;
  /** The save row — the button and its status line, owned by the caller. */
  footer: ReactNode;
}) {
  return (
    <SettingsCard
      title="Details"
      blurb="The wording that names the magazine — on the library masthead, the sign-in screen, the page footer and every email."
    >
      <TextField
        id="magazine-name"
        label="Magazine name"
        value={form.magazineName}
        fallback={defaults.name}
        maxLength={80}
        hint="The masthead. Also the classic theme's running head and the title of every email."
        onChange={(magazineName) => onChange({ magazineName })}
      />
      <TextField
        id="org-name"
        label="Club or organisation"
        value={form.orgName}
        fallback={defaults.org}
        maxLength={80}
        hint="Who publishes it. Sits beside the mark in the page footer."
        onChange={(orgName) => onChange({ orgName })}
      />
      <TextField
        id="tagline"
        label="Tagline"
        value={form.tagline}
        fallback={defaults.tagline}
        maxLength={200}
        hint="One line under the club name on the library page. Never printed."
        onChange={(tagline) => onChange({ tagline })}
      />

      <div className="border-line-soft border-t pt-5">
        <h3 className="text-ink font-serif text-lg leading-tight">
          Page footer
        </h3>
        <p className="text-muted mt-1.5 font-sans text-[13px] leading-relaxed">
          How the foot of every page is set. Text size applies whether or not
          the issue carries a mark; the mark&rsquo;s size and where the lockup
          sits apply to issues that have one.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <Choice
          label="Mark size"
          options={MARK_SIZES}
          labels={MARK_SIZE_LABELS}
          value={form.footerMarkSize}
          onSelect={(footerMarkSize: MarkSize) => onChange({ footerMarkSize })}
        />
        <Choice
          label="Text size"
          options={TEXT_SIZES}
          labels={TEXT_SIZE_LABELS}
          value={form.footerTextSize}
          onSelect={(footerTextSize: TextSize) => onChange({ footerTextSize })}
        />
        <Choice
          label="Align"
          options={FOOTER_ALIGNS}
          labels={FOOTER_ALIGN_LABELS}
          value={form.footerAlign}
          onSelect={(footerAlign: FooterAlign) => onChange({ footerAlign })}
        />
      </div>
      <p className="text-faint2 font-sans text-[12px] leading-relaxed">
        Alignment is the same on both pages of a spread and on a phone — the
        page number always sits at the opposite margin. Making the footer
        smaller applies everywhere at once. Making it bigger applies to every
        issue with room for it; one whose pages were filled to the old footer
        keeps the smaller one until you open it in the editor, which offers to
        bring it up to date and marks any page that then no longer fits.
      </p>

      <div className="border-line-soft border-t pt-5">{footer}</div>
    </SettingsCard>
  );
}

function TextField({
  id,
  label,
  value,
  fallback,
  hint,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  hint: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  // Empty is a real state, not a mistake: it means "fall back to what this
  // deployment was set up with", and the note below says so in as many words.
  const usingDefault = value.trim() === "";
  return (
    <div>
      <label
        htmlFor={id}
        className="text-faint mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.14em] uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={fallback}
        aria-describedby={`${id}-hint`}
        className="border-hair focus:border-accent text-ink h-12 w-full rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-[15px] outline-none"
      />
      <p
        id={`${id}-hint`}
        className="text-faint2 mt-1.5 font-sans text-[12px] leading-relaxed"
      >
        {hint}
        {usingDefault && (
          <>
            {" "}
            <span className="text-faint font-semibold">
              Empty — using this deployment&rsquo;s default, &ldquo;{fallback}
              &rdquo;.
            </span>
          </>
        )}
      </p>
    </div>
  );
}

// A labelled dropdown in the house style — the same MenuSelect the editor's
// theme and logo pickers use, so the admin has one kind of dropdown, not two.
function Choice<T extends string>({
  label,
  options,
  labels,
  value,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onSelect: (value: T) => void;
}) {
  const items: MenuSelectItem<T>[] = options.map((option) => ({
    key: option,
    value: option,
    content: labels[option],
  }));
  return (
    <MenuSelect
      label={label}
      current={labels[value]}
      ariaLabel={`Footer ${label.toLowerCase()}`}
      items={items}
      value={value}
      onSelect={onSelect}
    />
  );
}
