// Pure, transport-agnostic pieces of the email blast: the batch size, the
// chunker, and the sent/failed tally loop. Kept out of server/publish-email.ts
// (which is `server-only` and pulls in the DB + Resend) so this logic can be
// unit-tested in isolation.

// Resend's batch endpoint accepts up to 100 messages per call. It's also the
// unit of partial failure: a chunk either lands whole or is counted failed, and
// the blast carries on — a mid-batch outage never aborts an already-committed
// publish.
export const BATCH_SIZE = 100;

export type PreparedEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type BlastResult = { sent: number; failed: number };

// true = the whole chunk was accepted; false = it failed (counts its slice as
// failed). Implementations must not throw — they own their own error handling.
export type SendChunk = (emails: PreparedEmail[]) => Promise<boolean>;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Walk the chunks, tallying sent vs failed. Factored out so partial failure can
// be exercised directly with a stub SendChunk.
export async function tallyChunks(
  emails: PreparedEmail[],
  sendChunk: SendChunk,
): Promise<BlastResult> {
  let sent = 0;
  for (const batch of chunk(emails, BATCH_SIZE)) {
    const ok = await sendChunk(batch);
    if (ok) sent += batch.length;
  }
  return { sent, failed: emails.length - sent };
}
