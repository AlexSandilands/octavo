"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { SponsorListItem } from "@/lib/sponsors";
import {
  createSponsorAction,
  updateSponsorAction,
} from "@/app/admin/sponsors/actions";

// Add / edit one sponsor. Logo upload reuses POST /api/admin/images (the same
// route and pipeline the editor's image block uses — WebP + an images row); the
// returned imageId is submitted as the sponsor's logoId. Name is required; href
// and the "active until" date are optional. On save the colocated server action
// validates and persists, then the manager refreshes the list.
export function SponsorDialog({
  sponsor,
  onClose,
  onSaved,
}: {
  sponsor: SponsorListItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = sponsor !== null;
  const [name, setName] = useState(sponsor?.name ?? "");
  const [href, setHref] = useState(sponsor?.href ?? "");
  const [activeUntil, setActiveUntil] = useState(sponsor?.activeUntil ?? "");
  const [logoId, setLogoId] = useState<string | null>(sponsor?.logoId ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    sponsor?.logo?.url ?? null,
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/images", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
      setLogoId(data.imageId);
      setLogoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError("A sponsor needs a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      name: name.trim(),
      href: href.trim(),
      logoId,
      activeUntil,
    };
    try {
      const res =
        editing && sponsor
          ? await updateSponsorAction(sponsor.id, input)
          : await createSponsorAction(input);
      if (!res.ok) {
        setError(
          res.reason === "invalid"
            ? "Please check the fields and try again."
            : "Could not save. Please try again.",
        );
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err) {
      console.error("Saving sponsor failed", err);
      setError("Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4">
      <div className="bg-card max-h-[90vh] w-[520px] overflow-y-auto rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between px-8 pt-7">
          <h2 className="text-ink font-serif text-[26px] leading-tight">
            {editing ? "Edit sponsor" : "Add sponsor"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink"
            aria-label="Close"
          >
            <Icon name="close" size={22} strokeWidth={1.7} />
          </button>
        </div>

        <div className="space-y-5 px-8 pt-6">
          <Field label="Name" htmlFor="sponsor-name">
            <input
              id="sponsor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Kawau Bay Hardware"
              className="border-hair focus:border-accent text-ink h-12 w-full rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-[15px] outline-none"
            />
          </Field>

          <Field label="Link (optional)" htmlFor="sponsor-href">
            <input
              id="sponsor-href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              maxLength={2000}
              placeholder="example.com or https://example.com"
              className="border-hair focus:border-accent text-ink h-12 w-full rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-[15px] outline-none"
            />
          </Field>

          <Field label="Logo (optional)" htmlFor="">
            <div className="flex items-center gap-4">
              <div className="border-line flex h-16 w-28 flex-none items-center justify-center overflow-hidden rounded-lg border bg-white">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-faint2 font-mono text-[10px]">
                    NO LOGO
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="border-hair text-ink hover:border-accent flex h-9 items-center gap-1.5 rounded-lg border-[1.5px] bg-white px-3 font-sans text-[13px] font-semibold disabled:opacity-60"
                >
                  <Icon name="upload" size={15} className="text-accent" />
                  {uploading
                    ? "Uploading…"
                    : logoUrl
                      ? "Replace logo"
                      : "Upload logo"}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoId(null);
                      setLogoUrl(null);
                    }}
                    className="text-faint2 hover:text-warn font-sans text-[12px] font-medium"
                  >
                    Remove logo
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="hidden"
              />
            </div>
          </Field>

          <Field label="Active until (optional)" htmlFor="sponsor-active">
            <input
              id="sponsor-active"
              type="date"
              value={activeUntil}
              onChange={(e) => setActiveUntil(e.target.value)}
              className="border-hair focus:border-accent text-ink h-12 rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-[15px] outline-none"
            />
            <p className="text-faint2 mt-1.5 font-sans text-[12px]">
              After this date the sponsor is flagged expired here. It is not
              removed from issues automatically.
            </p>
          </Field>
        </div>

        {error && (
          <p className="text-warn px-8 pt-4 font-sans text-[13px] font-semibold">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 px-8 pt-6 pb-7">
          <button
            onClick={onClose}
            disabled={saving}
            className="border-hair text-ink flex h-12 items-center rounded-lg border-[1.5px] bg-white px-5 font-sans text-[15px] font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || uploading}
            className="bg-accent text-paper flex h-12 items-center gap-2 rounded-lg px-6 font-sans text-[15px] font-semibold shadow-[0_2px_10px_rgba(29,77,62,0.3)] disabled:opacity-60"
          >
            <Icon name="check" size={18} strokeWidth={1.8} />
            {saving ? "Saving…" : editing ? "Save changes" : "Save sponsor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor || undefined}
        className="text-faint mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.14em] uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
