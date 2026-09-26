"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { ResolvedImage } from "@/lib/images";

// Photos attached in the assistant's composer (#343). Each goes through the
// editor's own upload route the moment it's attached and becomes an ordinary
// issue photo, unplaced until the model (or the author) places it. The message
// carries only their ids; the model looks at them with view_photo.

export const MAX_ATTACHMENTS = 10;

export type Attachment = {
  key: string;
  name: string;
  /** A local preview, revoked when the thumbnail goes. */
  preview: string;
  status: "uploading" | "done" | "failed";
  imageId?: string;
  /** The upload route's own words, when it refused the file. */
  error?: string;
};

const uploaded = z.object({
  imageId: z.string().min(1),
  url: z.string().min(1),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

export function useAttachments({
  issueId,
  onUploaded,
}: {
  issueId: string;
  /** The editor learns the photo, so the projection lists it as unplaced. */
  onUploaded: (imageId: string, image: ResolvedImage) => void;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const latest = useRef({ items, onUploaded });
  useEffect(() => {
    latest.current = { items, onUploaded };
  });
  // Previews still showing when the composer goes are let go.
  useEffect(
    () => () => latest.current.items.forEach((a) => revoke(a.preview)),
    [],
  );

  const update = (key: string, patch: Partial<Attachment>) =>
    setItems((all) => all.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const upload = async (key: string, file: File) => {
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("issueId", issueId);
      const res = await fetch("/api/admin/images", { method: "POST", body });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const said = z.object({ error: z.string() }).safeParse(data);
        throw new Error(said.success ? said.data.error : "Upload failed.");
      }
      const { imageId, ...image } = uploaded.parse(data);
      latest.current.onUploaded(imageId, image);
      update(key, { status: "done", imageId });
    } catch (err) {
      update(key, {
        status: "failed",
        error:
          err instanceof Error && err.message
            ? err.message
            : "Upload failed. Check your connection and try again.",
      });
    }
  };

  /** Uploads each file, up to the per-message limit; says so when some are left out. */
  const add = (files: File[]) => {
    const room =
      MAX_ATTACHMENTS -
      latest.current.items.filter((a) => a.status !== "failed").length;
    const taken = files.slice(0, Math.max(0, room));
    setNote(
      taken.length < files.length
        ? `Up to ${MAX_ATTACHMENTS} photos a message. ${files.length - taken.length === 1 ? "One wasn't" : `${files.length - taken.length} weren't`} attached.`
        : null,
    );
    const added = taken.map((file) => ({
      key: crypto.randomUUID(),
      name: file.name || "Pasted photo",
      preview: URL.createObjectURL(file),
      status: "uploading" as const,
    }));
    setItems((all) => [...all, ...added]);
    added.forEach((a, i) => void upload(a.key, taken[i]!));
  };

  const remove = (key: string) => {
    const gone = latest.current.items.find((a) => a.key === key);
    if (gone) revoke(gone.preview);
    setItems((all) => all.filter((a) => a.key !== key));
    setNote(null);
  };

  /** After sending: the photos are the issue's now, and the composer empties. */
  const clear = () => {
    latest.current.items.forEach((a) => revoke(a.preview));
    setItems([]);
    setNote(null);
  };

  return {
    items,
    note,
    /** Ids of the photos ready to go with the message. */
    ids: items.flatMap((a) => (a.status === "done" ? [a.imageId!] : [])),
    uploading: items.some((a) => a.status === "uploading"),
    failed: items.some((a) => a.status === "failed"),
    add,
    remove,
    clear,
  };
}

const revoke = (url: string) => URL.revokeObjectURL(url);

/** The files in a paste or a drop. Every one goes to the upload route, which
 *  answers a file it won't take in its own words. */
export const filesOf = (data: DataTransfer | null): File[] => [
  ...(data?.files ?? []),
];
