"use client";

import { useRef, useState } from "react";
import { DialogShell, dialogPanel } from "@/components/dialog-shell";
import {
  DialogFooter,
  DialogTitle,
  Field,
  INPUT_CLASS,
} from "@/components/dialog-parts";
import { Button } from "@/components/ui";
import type { LogoListItem } from "@/lib/logos";
import {
  createLogoAction,
  renameLogoAction,
} from "@/app/admin/magazine/logo-actions";

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
    <DialogShell
      panelClassName={dialogPanel(
        "scrollbar-soft max-h-[90vh] w-[540px] overflow-y-auto [scrollbar-gutter:stable]",
      )}
      locked={saving}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="px-7 pt-6">
            <DialogTitle
              id={titleId}
              kicker="Logos"
              onClose={onClose}
              closeDisabled={saving}
            >
              {renaming ? "Rename logo" : "Add logo"}
            </DialogTitle>
          </div>

          <div className="flex flex-col gap-5 px-7 pt-6">
            <Field label="Name" htmlFor="logo-name">
              <input
                id="logo-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="e.g. Club fern"
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label="Mark"
              hint={
                renaming
                  ? undefined
                  : "Use a PNG or WebP with a transparent background — see-through areas are kept, so the mark sits cleanly on the page."
              }
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="border-lead bg-sheet flex h-20 w-20 flex-none items-center justify-center overflow-hidden border">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    <span className="text-grey-soft font-ui text-[11px] font-semibold tracking-[0.08em]">
                      NO MARK
                    </span>
                  )}
                </div>
                {renaming ? (
                  <p className="text-grey-soft max-w-[300px] font-ui text-[14px] leading-relaxed">
                    The image itself can&rsquo;t be swapped — add a new logo and
                    delete this one instead.
                  </p>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="upload"
                    iconPosition="left"
                    onClick={() => fileRef.current?.click()}
                    busy={uploading}
                  >
                    {uploading
                      ? "Uploading…"
                      : imageUrl
                        ? "Replace image"
                        : "Choose image"}
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/webp,image/avif"
                  onChange={onFile}
                  className="hidden"
                />
              </div>
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="text-red px-7 pt-4 font-ui text-[15px] font-semibold"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              busy={saving}
              disabled={uploading}
              icon="check"
              iconPosition="left"
            >
              {saving ? "Saving…" : renaming ? "Save name" : "Save logo"}
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogShell>
  );
}
