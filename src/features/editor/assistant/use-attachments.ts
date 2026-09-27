"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { imageUploadRefusal } from "@/lib/image-upload-limits";
import type { ResolvedImage } from "@/lib/images";

// Photos attached in the assistant's composer (#343). Each goes through the
// editor's own upload route the moment it's attached and becomes an ordinary
// issue photo, unplaced until the model (or the author) places it. The message
// carries only their ids; the model looks at them with view_photo.

/** Per message. The model's first look at each is outside its views per run (#365). */
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
    // Pasted images all arrive as "image.png": number the repeats, so each
    // thumbnail and remove button says which it is.
    const names = latest.current.items.map((a) => a.name);
    const added = taken.map((file): Attachment => {
      const base = file.name || "Pasted photo";
      let name = base;
      for (let n = 2; names.includes(name); n++) name = `${base} (${n})`;
      names.push(name);
      const refused = imageUploadRefusal(file);
      return {
        key: crypto.randomUUID(),
        name,
        preview: URL.createObjectURL(file),
        // A file the route would refuse isn't sent; it says why in the same words.
        ...(refused
          ? { status: "failed", error: refused }
          : { status: "uploading" }),
      };
    });
    setItems((all) => [...all, ...added]);
    added.forEach((a, i) => {
      if (a.status === "uploading") void upload(a.key, taken[i]!);
    });
  };

  const remove = (key: string) => {
    const gone = latest.current.items.find((a) => a.key === key);
    if (gone) revoke(gone.preview);
    setItems((all) => all.filter((a) => a.key !== key));
    setNote(null);
  };

  /** After sending: the photos sent are the issue's now, and leave the tray.
   *  (One attached meanwhile stays for the next message.) */
  const clear = (sent: string[]) => {
    const gone = (a: Attachment) =>
      Boolean(a.imageId && sent.includes(a.imageId));
    latest.current.items.filter(gone).forEach((a) => revoke(a.preview));
    setItems((all) => all.filter((a) => !gone(a)));
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

/** The files in a drop; one the route won't take is refused in its words. */
export const filesOf = (data: DataTransfer | null): File[] => [
  ...(data?.files ?? []),
];

/** The files in a paste, only when it carries no text: Office pastes a picture
 *  of the text beside the text itself, and the text is what was meant. */
export const pastedFiles = (data: DataTransfer | null): File[] =>
  data?.types.includes("text/plain") ? [] : filesOf(data);
