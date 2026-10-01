"use client";

import { useRef, useState } from "react";
import { needsCostConfirm } from "./paste-estimate";
import type { SendResult, useAssistantChat } from "./use-assistant-chat";

// The one way a message reaches the conversation (#312): the composer, the
// presets, and every Ask box (blocks, cover items, the cover's text bar) send
// through `ask`, so the cost question can't be skipped. A message over
// CONFIRM_FROM_CHARS waits for the panel's question instead of going:
// `confirm` sends it, `cancel` hands it back. The estimate counts the text
// only. Attached photos add their ids, not their bytes; they cost what the
// model spends looking at them, which isn't known at send time.

/** What a surface sends: its words and the ids of the photos attached to them. */
export type Outgoing = { text: string; attachments: string[] };
type Held = Outgoing & { taken: () => void };

export function useConfirmedSend(
  chat: Pick<ReturnType<typeof useAssistantChat>, "send">,
) {
  const [pending, setPending] = useState<Held | null>(null);
  // Read as it is now: two asks in one tick can't both raise a question.
  const held = useRef<Held | null>(null);
  const sending = useRef(false);
  const hold = (next: Held | null) => {
    held.current = next;
    setPending(next);
  };
  const go = async (message: Held): Promise<SendResult> => {
    const result = await chat.send(message.text, message.attachments);
    if (result.ok) message.taken();
    return result;
  };

  return {
    /** The message waiting on the question, if one is. */
    pending: pending && {
      text: pending.text,
      attachments: pending.attachments,
    },
    /**
     * Sends, or holds a long message for the question (`confirming`). `taken`
     * runs once the chat has the message, now or on Continue: that is when the
     * surface clears. While a question is up nothing else goes (`waiting`).
     */
    async ask(message: Outgoing, taken = () => {}): Promise<SendResult> {
      if (held.current) return { ok: false, reason: "waiting" };
      if (sending.current) return { ok: false, reason: "busy" };
      const next = { ...message, taken };
      if (needsCostConfirm(message.text.length)) {
        hold(next);
        return { ok: false, reason: "confirming" };
      }
      sending.current = true;
      try {
        return await go(next);
      } finally {
        sending.current = false;
      }
    },
    /** Continue: the held message goes; it stays held if the chat refuses it. */
    async confirm(): Promise<SendResult> {
      const message = held.current;
      if (!message) return { ok: false, reason: "invalid" };
      if (sending.current) return { ok: false, reason: "busy" };
      sending.current = true;
      try {
        const result = await go(message);
        if (result.ok && held.current === message) hold(null);
        return result;
      } finally {
        sending.current = false;
      }
    },
    /** Cancel: nothing is sent, and the held message comes back to its caller. */
    cancel(): Outgoing | null {
      const message = held.current;
      hold(null);
      return (
        message && { text: message.text, attachments: message.attachments }
      );
    },
  };
}

export type ConfirmedSend = ReturnType<typeof useConfirmedSend>;
