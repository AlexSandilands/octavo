"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  resolveSettings,
  type FooterAlign,
  type MarkSize,
  type SiteSettings,
  type StoredSettings,
  type TextSize,
} from "@/lib/branding";
import type { LogoListItem } from "@/lib/logos";
import { LogosManager } from "@/features/logos/logos-manager";
import { updateSettingsAction } from "@/app/admin/magazine/actions";
import { ResizableSplit } from "./resizable-split";
import { SettingsFormCard } from "./settings-cards";
import { SettingsPreview } from "./settings-preview";

// Client owner of the magazine settings: the form state, the save, and the
// preview that renders the *unsaved* state so the owner can see a change before
// committing to it. The cards and the preview are presentation; everything that
// changes lives here.

/** The form's own shape. Text fields are plain strings — "" is how the UI says
 *  "use the deployment default", which the action stores as NULL. Holding raw
 *  strings (rather than `string | null`) keeps typing a space mid-word from
 *  collapsing the field to null under the cursor. */
export type SettingsForm = {
  magazineName: string;
  orgName: string;
  tagline: string;
  footerMarkSize: MarkSize;
  footerTextSize: TextSize;
  footerAlign: FooterAlign;
};

function toForm(stored: StoredSettings, defaults: SiteSettings): SettingsForm {
  return {
    magazineName: stored.magazineName ?? "",
    orgName: stored.orgName ?? "",
    tagline: stored.tagline ?? "",
    footerMarkSize: stored.footerMarkSize ?? defaults.footer.markSize,
    footerTextSize: stored.footerTextSize ?? defaults.footer.textSize,
    footerAlign: stored.footerAlign ?? defaults.footer.align,
  };
}

function toStored(form: SettingsForm): StoredSettings {
  const text = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    magazineName: text(form.magazineName),
    orgName: text(form.orgName),
    tagline: text(form.tagline),
    footerMarkSize: form.footerMarkSize,
    footerTextSize: form.footerTextSize,
    footerAlign: form.footerAlign,
  };
}

type Status = "idle" | "saving" | "saved" | "error";

export function MagazineSettings({
  stored,
  defaults,
  logos,
}: {
  stored: StoredSettings;
  /** What an empty field falls back to — this deployment's NEXT_PUBLIC_* values
   *  and the shipped footer look. */
  defaults: SiteSettings;
  logos: LogoListItem[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsForm>(() =>
    toForm(stored, defaults),
  );
  const [saved, setSaved] = useState<SettingsForm>(form);
  const [status, setStatus] = useState<Status>("idle");

  // The preview resolves exactly as the server will: the same pure function,
  // over the same defaults, on the state the owner is looking at.
  const preview = resolveSettings(toStored(form), defaults);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const change = (patch: Partial<SettingsForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (status !== "saving") setStatus("idle");
  };

  const save = async () => {
    setStatus("saving");
    const submitted = form;
    try {
      const result = await updateSettingsAction(toStored(submitted));
      if (!result.ok) {
        setStatus("error");
        return;
      }
      setSaved(submitted);
      setStatus("saved");
      // The branding is already re-rendered everywhere by the action's
      // revalidate; refresh so this page's own server data matches too.
      router.refresh();
    } catch (err) {
      console.error("Saving magazine settings failed", err);
      setStatus("error");
    }
  };

  return (
    <ResizableSplit
      storageKey="magazine-settings-split"
      label="Settings and preview split"
      left={
        <>
          <SettingsFormCard
            form={form}
            defaults={defaults}
            onChange={change}
            footer={
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={save}
                  disabled={!dirty && status !== "error"}
                  busy={status === "saving"}
                >
                  {status === "saving" ? "Saving…" : "Save changes"}
                </Button>
                <p
                  role="status"
                  aria-live="polite"
                  className="font-sans text-[13px] font-medium"
                >
                  {status === "saved" && !dirty && (
                    <span className="text-accent">
                      Saved — live on the site now.
                    </span>
                  )}
                  {status === "error" && (
                    <span className="text-warn">
                      Couldn&rsquo;t save. Please try again.
                    </span>
                  )}
                  {status !== "error" && dirty && (
                    <span className="text-faint">Unsaved changes.</span>
                  )}
                </p>
              </div>
            }
          />
          <LogosManager logos={logos} />
        </>
      }
      right={<SettingsPreview settings={preview} logos={logos} />}
    />
  );
}
