"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { LogoListItem } from "@/lib/logos";
import { createLogoAction, renameLogoAction } from "@/app/admin/logos/actions";

// Add a logo (name + mark) or rename an existing one. The upload reuses
// POST /api/admin/images — the same route and pipeline the editor's image block
// and the sponsor logo use (WebP + an images row), which preserves the
// transparency a mark depends on — and the returned imageId becomes the logo's
// imageId. Renaming is the only edit: the mark is the record's identity, so
// changing it means adding a new logo, not editing this one.
export function LogoDialog({
  logo,
  onClose,
  onSaved,
}: {
  logo: LogoListItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const renaming = logo !== null;
  const [name, setName] = useState(logo?.name ?? "");
  const [imageId, setImageId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(
    logo?.image.url ?? null,
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
      setImageId(data.imageId);
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError("A logo needs a name.");
      return;
    }
    if (!renaming && !imageId) {
      setError("Choose an image file for the logo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res =
        renaming && logo
          ? await renameLogoAction(logo.id, name.trim())
          : await createLogoAction({ name: name.trim(), imageId });
      if (!res.ok) {
        setError(
          res.reason === "missing-image"
            ? "That image is no longer available. Upload it again."
            : res.reason === "invalid"
              ? "Please check the fields and try again."
              : "Could not save. Please try again.",
        );
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err) {
      console.error("Saving logo failed", err);
      setError("Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4">
      <div className="bg-card max-h-[90vh] w-[520px] overflow-y-auto rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between px-8 pt-7">
          <h2 className="text-ink font-serif text-[26px] leading-tight">
            {renaming ? "Rename logo" : "Add logo"}
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
          <div>
            <label
              htmlFor="logo-name"
              className="text-faint mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.14em] uppercase"
            >
              Name
            </label>
            <input
              id="logo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Club fern"
              className="border-hair focus:border-accent text-ink h-12 w-full rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-[15px] outline-none"
            />
          </div>

          <div>
            <span className="text-faint mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.14em] uppercase">
              Mark
            </span>
            <div className="flex items-center gap-4">
              <div className="border-line flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-lg border bg-white">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <span className="text-faint2 font-mono text-[10px]">
                    NO MARK
                  </span>
                )}
              </div>
              {renaming ? (
                <p className="text-faint2 max-w-[280px] font-sans text-[12px] leading-relaxed">
                  The image itself can&rsquo;t be swapped — add a new logo and
                  delete this one instead.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="border-hair text-ink hover:border-accent flex h-9 items-center gap-1.5 rounded-lg border-[1.5px] bg-white px-3 font-sans text-[13px] font-semibold disabled:opacity-60"
                >
                  <Icon name="upload" size={15} className="text-accent" />
                  {uploading
                    ? "Uploading…"
                    : imageUrl
                      ? "Replace image"
                      : "Choose image"}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/webp,image/avif"
                onChange={onFile}
                className="hidden"
              />
            </div>
            {!renaming && (
              <p className="text-faint2 mt-2 font-sans text-[12px] leading-relaxed">
                Use a PNG or WebP with a transparent background — see-through
                areas are kept, so the mark sits cleanly on the page.
              </p>
            )}
          </div>
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
            {saving ? "Saving…" : renaming ? "Save name" : "Save logo"}
          </button>
        </div>
      </div>
    </div>
  );
}
