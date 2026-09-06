"use client";

import { useRef, useState } from "react";
import { DialogShell } from "@/components/dialog-shell";
import {
  DialogActions,
  DialogBody,
  DialogHeader,
  Field,
  FIELD_CLASS,
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
      panelClassName="md:w-[540px]"
      locked={saving}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <DialogHeader
            titleId={titleId}
            kicker="Logos"
            title={renaming ? "Rename logo" : "Add logo"}
            onClose={onClose}
            closeDisabled={saving}
          />

          <DialogBody className="mt-5 flex flex-col gap-5">
            <Field label="Name" htmlFor="logo-name">
              <input
                id="logo-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="e.g. Club fern"
                className={FIELD_CLASS}
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
                <div className="border-hairline bg-surface-2 flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-field border">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    <span className="text-fg-muted font-ui text-[11px] font-bold tracking-[0.08em]">
                      NO MARK
                    </span>
                  )}
                </div>
                {renaming ? (
                  <p className="text-fg-muted max-w-[300px] font-ui text-[15px] leading-relaxed">
                    The image itself can&rsquo;t be swapped — add a new logo and
                    delete this one instead.
                  </p>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="upload"
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

            {error && (
              <p
                role="alert"
                className="text-danger font-ui text-[15px] font-bold"
              >
                {error}
              </p>
            )}
          </DialogBody>

          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              busy={saving}
              disabled={uploading}
              icon="check"
            >
              {saving ? "Saving…" : renaming ? "Save name" : "Save logo"}
            </Button>
          </DialogActions>
        </>
      )}
    </DialogShell>
  );
}
