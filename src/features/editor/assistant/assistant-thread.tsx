"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { AiError } from "@/lib/ai-chat-contract";
import { Icon } from "@/components/icons";
import { attachedCount, photos } from "./attached";
import { withoutBlockIds } from "./presets";
import { ReplyText } from "./reply-text";
import { isReview } from "./review";
import type { AssistantMessage } from "./use-assistant-chat";

type Part = AssistantMessage["parts"][number];

// Each tool as the author reads it: while it runs, and once it has.
const TOOL_WORDS: Record<string, [doing: string, done: string]> = {
  set_text: ["Rewriting a text block", "Rewrote a text block"],
  set_heading: ["Changing a heading", "Changed a heading"],
  insert_blocks: ["Adding to the page", "Added to the page"],
  delete_block: ["Removing a block", "Removed a block"],
  move_block: ["Moving a block", "Moved a block"],
  add_page: ["Adding a page", "Added a page"],
  split_page: ["Carrying text onto a new page", "Carried text onto a new page"],
  set_image_text: ["Changing a photo's words", "Changed a photo's words"],
  set_image_layout: ["Placing a photo", "Placed a photo"],
  view_photo: ["Looking at a photo", "Looked at a photo"],
};
// Tools that name a page: [running, done, failed].
const PAGE_WORDS: Record<string, [string, string, string]> = {
  read_page: ["Reading page", "Read page", "Couldn’t read page"],
  view_page: ["Looking at page", "Looked at page", "Couldn’t look at page"],
};

/** A tool call as one quiet line in the thread: what the assistant did. */
function toolLine(part: Part): string | null {
  if (!part.type.startsWith("tool-") || !("state" in part)) return null;
  const name = part.type.slice(5);
  const failed =
    part.state === "output-error" ||
    (part.state === "output-available" &&
      (part.output as { text?: string } | undefined)?.text?.startsWith(
        "Error:",
      ));
  const paged = PAGE_WORDS[name];
  if (paged) {
    const page = ("input" in part ? part.input : undefined) as
      | { page?: number }
      | undefined;
    const n = page?.page;
    if (failed) return `${paged[2]} ${n}`;
    return part.state === "output-available"
      ? `${paged[1]} ${n}`
      : `${paged[0]} ${n ?? ""}…`;
  }
  const words = TOOL_WORDS[name];
  if (!words) return null;
  if (failed) return `${words[0]} didn’t work; nothing changed`;
  return part.state === "output-available" ? words[1] : `${words[0]}…`;
}

/** Whether a part shows anything; a reply opens with an empty reasoning part. */
const shows = (part: Part) =>
  part.type === "text" ? part.text.trim() !== "" : toolLine(part) !== null;

function Message({ message }: { message: AssistantMessage }) {
  if (message.role === "user" && isReview(message.parts)) {
    // The editor's own end-of-run review (#342): the pages it sent, not words.
    const pages = message.parts
      .slice(1)
      .flatMap((p) => (p.type === "text" ? [p.text] : []));
    return (
      <p className="text-faint font-sans text-[13px]">
        Showed it the pages it changed to look over: {pages.join(", ")}
      </p>
    );
  }
  if (message.role === "user") {
    // The projection rides in a data part the author never sees; attached
    // photos (#343) read as a count, not their ids.
    const said = message.parts.flatMap((p) =>
      p.type === "text" ? [p.text] : [],
    );
    const attached = said.reduce((n, t) => n + attachedCount(t), 0);
    const text = withoutBlockIds(
      said.filter((t) => !attachedCount(t)).join(""),
    );
    return (
      <div className="bg-accent-wash text-ink flex flex-col gap-1.5 self-end rounded-xl rounded-br-sm px-3.5 py-2.5 font-sans text-[15px] leading-snug whitespace-pre-wrap">
        <span className="sr-only">You: </span>
        {text && <span>{text}</span>}
        {attached > 0 && (
          <span className="text-muted flex items-center gap-1.5 text-[13px] font-semibold">
            <Icon name="image" size={15} />
            {photos(attached)} attached
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="text-ink flex flex-col gap-2 font-serif text-[16px] leading-relaxed">
      <span className="sr-only">Assistant: </span>
      {message.parts.map((part, i) => {
        if (part.type === "text")
          return part.text.trim() ? (
            <ReplyText key={i} text={part.text} />
          ) : null;
        const line = toolLine(part);
        return line ? (
          <p key={i} className="text-faint font-sans text-[13px]">
            {line}
          </p>
        ) : null;
      })}
    </div>
  );
}

// The conversation, oldest first. A `role="log"` region: busy while a reply
// streams, so assistive tech announces the finished reply once rather than
// every word as it arrives. Errors from the route show inline, in its words.
export function AssistantThread({
  messages,
  busy,
  error,
  intro,
  after,
  reviewing = false,
}: {
  messages: AssistantMessage[];
  busy: boolean;
  /** The pages it changed are being pictured for its review (#342). */
  reviewing?: boolean;
  error: AiError | null;
  intro: string;
  /** What the last run left: its change and Undo, or why it stopped. */
  after?: ReactNode;
}) {
  const log = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  // "Thinking…" until the reply has something to show, not merely begun.
  const waiting =
    busy && !(last?.role === "assistant" && last.parts.some(shows));
  const tail = last ? JSON.stringify(last.parts).length : 0;
  // Follow the newest words, as a chat does. Not scrollIntoView: that would
  // also scroll the panel's clipped ancestors.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, tail, error, after]);

  return (
    <div
      ref={log}
      role="log"
      aria-label="Conversation with the assistant"
      aria-busy={busy}
      className="scrollbar-soft flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 [--scrollbar-surface:var(--color-card)]"
    >
      {messages.length === 0 && (
        <p className="text-muted font-serif text-[16px] leading-relaxed whitespace-pre-line">
          {intro}
        </p>
      )}
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      {(waiting || (busy && reviewing)) && (
        <p className="text-faint font-sans text-[13px]">
          {reviewing ? "Picturing the pages it changed…" : "Thinking…"}
        </p>
      )}

      {!busy && after}
      {error && (
        <p className="border-warn text-warn rounded-lg border-l-4 bg-white px-3.5 py-2.5 font-sans text-[15px] leading-snug">
          {error.error}
        </p>
      )}
    </div>
  );
}
