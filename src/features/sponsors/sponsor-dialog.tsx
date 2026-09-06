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
    <DialogShell
      panelClassName="md:w-[540px]"
      locked={saving}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <DialogHeader
            titleId={titleId}
            kicker="Sponsors"
            title={editing ? "Edit sponsor" : "Add sponsor"}
            onClose={onClose}
            closeDisabled={saving}
          />

          <DialogBody className="mt-5 flex flex-col gap-5">
            <Field label="Name" htmlFor="sponsor-name">
              <input
                id="sponsor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="e.g. Kawau Bay Hardware"
                className={FIELD_CLASS}
              />
            </Field>

            <Field label="Link (optional)" htmlFor="sponsor-href">
              <input
                id="sponsor-href"
                value={href}
                onChange={(e) => setHref(e.target.value)}
                maxLength={2000}
                placeholder="example.com or https://example.com"
                className={FIELD_CLASS}
              />
            </Field>

            <Field label="Logo (optional)">
              <div className="flex flex-wrap items-center gap-4">
                <div className="border-hairline bg-surface-2 flex h-16 w-28 flex-none items-center justify-center overflow-hidden rounded-field border">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-fg-muted font-ui text-[11px] font-bold tracking-[0.08em]">
                      NO LOGO
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="upload"
                    onClick={() => fileRef.current?.click()}
                    busy={uploading}
                  >
                    {uploading
                      ? "Uploading…"
                      : logoUrl
                        ? "Replace logo"
                        : "Upload logo"}
                  </Button>
                  {logoUrl && (
                    <Button
                      variant="quiet"
                      size="sm"
                      icon="close"
                      onClick={() => {
                        setLogoId(null);
                        setLogoUrl(null);
                      }}
                    >
                      Remove logo
                    </Button>
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

            <Field
              label="Active until (optional)"
              htmlFor="sponsor-active"
              hint="After this date the sponsor is flagged expired here. It is not removed from issues automatically."
            >
              <input
                id="sponsor-active"
                type="date"
                value={activeUntil}
                onChange={(e) => setActiveUntil(e.target.value)}
                className={`${FIELD_CLASS} md:w-auto`}
              />
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
              {saving ? "Saving…" : editing ? "Save changes" : "Save sponsor"}
            </Button>
          </DialogActions>
        </>
      )}
    </DialogShell>
  );
}
