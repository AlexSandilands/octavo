"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { ResolvedImage } from "@/lib/images";

// The editor-only affordance for an image block: pick a file, POST it to the
// upload route, surface progress/errors, and report the stored image back so the
// block's `imageId` (and the live preview) update. Presentation of the image
// itself stays in BlockView — this is just the control.
export function ImageBlockControl({
  issueId,
  hasImage,
  onUploaded,
}: {
  issueId: string;
  hasImage: boolean;
  onUploaded: (imageId: string, image: ResolvedImage) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("issueId", issueId);
      const res = await fetch("/api/admin/images", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
      setLocal(Boolean(data.local));
      onUploaded(data.imageId, {
        url: data.url,
        width: data.width,
        height: data.height,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        disabled={busy}
        className="border-hair text-ink hover:border-accent flex h-7 items-center gap-1.5 rounded-[6px] border bg-white px-2.5 font-sans text-[12px] font-semibold disabled:opacity-60"
      >
        <Icon name="upload" size={15} className="text-accent" />
        {busy ? "Uploading…" : hasImage ? "Replace image" : "Upload image"}
      </button>
      {error && (
        <span className="text-warn font-sans text-[12px]">{error}</span>
      )}
      {local && !error && (
        <span className="text-faint2 font-sans text-[12px]">
          Saved to local dev storage
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}
