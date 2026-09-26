"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import { MAX_ATTACHMENTS, type useAttachments } from "./use-attachments";

type Attachments = ReturnType<typeof useAttachments>;

// The composer's photos (#343): the Attach photos button, and the thumbnails
// of what's attached, each with its remove button, how its upload is going and,
// if the upload route refused it, why in the route's own words.

export function AttachButton({
  attachments,
  disabled,
  buttonRef,
}: {
  attachments: Attachments;
  disabled: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const full =
    attachments.items.filter((a) => a.status !== "failed").length >=
    MAX_ATTACHMENTS;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || full}
        onClick={() => input.current?.click()}
        aria-label="Attach photos"
        title={
          full ? `Up to ${MAX_ATTACHMENTS} photos a message` : "Attach photos"
        }
        className="border-hair-warm text-ink enabled:hover:border-accent enabled:hover:bg-accent-wash flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg border-[1.5px] bg-white transition-colors disabled:cursor-default disabled:opacity-45"
      >
        <Icon name="image" size={19} />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(e) => {
          attachments.add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function AttachmentTray({
  attachments,
  attachButton,
}: {
  attachments: Attachments;
  /** Where the focus goes when the last thumbnail is removed. */
  attachButton: React.RefObject<HTMLButtonElement | null>;
}) {
  const { items, note } = attachments;
  const removes = useRef<(HTMLButtonElement | null)[]>([]);
  // After a remove, the focus moves to the thumbnail now in its place.
  const refocus = useRef<number | null>(null);
  useEffect(() => {
    const at = refocus.current;
    if (at === null) return;
    refocus.current = null;
    (
      removes.current[Math.min(at, items.length - 1)] ?? attachButton.current
    )?.focus();
  }, [items.length, attachButton]);

  const failed = items.filter((a) => a.status === "failed");
  const uploading = items.filter((a) => a.status === "uploading").length;
  const done = items.length - failed.length - uploading;
  if (!items.length && !note) return null;
  return (
    <div className="flex flex-col gap-2 px-2.5 pt-2.5">
      {items.length > 0 && (
        <ul aria-label="Attached photos" className="flex flex-wrap gap-2">
          {items.map((a, i) => (
            <li
              key={a.key}
              data-attachment={a.imageId ?? a.status}
              className={`relative h-16 w-16 flex-none overflow-hidden rounded-lg border-[1.5px] ${
                a.status === "failed" ? "border-warn" : "border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
              <img
                src={a.preview}
                alt={`${a.name}${a.status === "uploading" ? " (uploading)" : a.status === "failed" ? " (not uploaded)" : ""}`}
                className={`h-full w-full object-cover ${a.status === "done" ? "" : "opacity-45"}`}
              />
              <button
                ref={(el) => {
                  removes.current[i] = el;
                }}
                type="button"
                onClick={() => {
                  refocus.current = i;
                  attachments.remove(a.key);
                }}
                aria-label={`Remove ${a.name}`}
                title="Remove"
                className="text-ink hover:text-warn absolute top-0 right-0 flex h-11 w-11 cursor-pointer items-start justify-end p-1"
              >
                <span className="border-hair-warm flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm">
                  <Icon name="close" size={13} strokeWidth={2.2} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="text-faint px-0.5 font-sans text-[13px]">
        {uploading
          ? `Uploading ${uploading === 1 ? "1 photo" : `${uploading} photos`}…`
          : done
            ? `${done === 1 ? "1 photo" : `${done} photos`} attached. They're added to this issue's photos.`
            : ""}
      </p>
      {(failed.length > 0 || note) && (
        <div
          role="alert"
          className="text-warn px-0.5 font-sans text-[13px] leading-snug font-semibold"
        >
          {failed.map((a) => (
            <p key={a.key}>
              {a.name}: {a.error} Remove it to send.
            </p>
          ))}
          {note && <p>{note}</p>}
        </div>
      )}
    </div>
  );
}
