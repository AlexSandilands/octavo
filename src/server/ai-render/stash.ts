import "server-only";
import { randomUUID } from "node:crypto";
import type { IssueContent } from "@/lib/blocks";

// The draft a render request carries (#342), held in memory for the moment it
// takes Chromium to fetch the print page, under a one-time nonce. Unsaved edits
// never touch the database this way. On globalThis because Next bundles the
// route handler and the page separately; both run in the same server process,
// and the app runs as one instance (Railway), so the page always finds it.
// Entries expire, and every new one sweeps the expired, so a crashed render
// can't leak one; the route drops its own the moment it is done.

export type StashedDraft = {
  issueId: string;
  theme: string;
  logoId: string | null;
  content: IssueContent;
};

const TTL_MS = 60_000;
type Held = StashedDraft & { until: number };
const store = ((
  globalThis as { __assistantDrafts?: Map<string, Held> }
).__assistantDrafts ??= new Map<string, Held>());

export function stashDraft(draft: StashedDraft): string {
  const now = Date.now();
  for (const [key, held] of store) if (held.until <= now) store.delete(key);
  const nonce = randomUUID();
  store.set(nonce, { ...draft, until: now + TTL_MS });
  return nonce;
}

export function readDraft(nonce: string): StashedDraft | null {
  const held = store.get(nonce);
  return held && held.until > Date.now() ? held : null;
}

export function dropDraft(nonce: string): void {
  store.delete(nonce);
}
