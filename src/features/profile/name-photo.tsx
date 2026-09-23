"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { removePhotoAction } from "@/app/profile/actions";
import type { Announce } from "./names-shared";

const MAX_BYTES = 5 * 1024 * 1024;

// Change photo / Remove photo for one name. The picker is the native file
// input (no `capture`, so phones offer the photo library); the upload route
// does every real check, the size test here only saves a wasted upload.
export function NamePhoto({
  nameId,
  name,
  hasPhoto,
  announce,
  onError,
}: {
  nameId: string;
  name: string;
  hasPhoto: boolean;
  announce: Announce;
  onError: (reason: string | null) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  const upload = async (file: File) => {
    onError(null);
    if (file.size > MAX_BYTES) {
      fail("That photo is too large. Choose one under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(
        `/api/profile/avatar?name=${encodeURIComponent(nameId)}`,
        { method: "POST", body },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
      } | null;
      if (!response.ok || !result?.ok) {
        fail(
          result?.reason ?? "We couldn't save that photo. Please try again.",
        );
        return;
      }
      announce(`Photo updated for “${name}”.`);
      startTransition(() => router.refresh());
    } catch {
      fail("We couldn't reach the site. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
      requestAnimationFrame(() => changeButton.current?.focus());
    }
  };

  const fail = (reason: string) => {
    onError(reason);
    announce(reason);
  };

  const remove = () => {
    onError(null);
    startTransition(async () => {
      const result = await removePhotoAction(nameId);
      if (!result.ok) {
        fail(result.reason);
        return;
      }
      announce(`Photo removed from “${name}”.`);
      requestAnimationFrame(() => changeButton.current?.focus());
    });
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        ref={changeButton}
        variant="secondary"
        size="sm"
        icon="image"
        iconPosition="left"
        busy={uploading}
        unavailable={pending}
        aria-label={`${uploading ? "Uploading photo" : "Change photo"} for ${name}`}
        onClick={() => input.current?.click()}
        className="min-h-11"
      >
        {uploading ? "Uploading…" : "Change photo"}
      </Button>
      {hasPhoto && (
        <Button
          variant="secondary"
          size="sm"
          icon="close"
          iconPosition="left"
          unavailable={busy}
          aria-label={`Remove photo from ${name}`}
          onClick={remove}
          className="min-h-11"
        >
          Remove photo
        </Button>
      )}
    </>
  );
}
