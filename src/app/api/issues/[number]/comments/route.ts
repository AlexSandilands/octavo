import { NextResponse } from "next/server";
import { z } from "zod";
import { DISCUSSION_OFF } from "@/server/discussion-guard";
import {
  loadThreadPayload,
  publishedIssueId,
} from "@/server/discussion-thread";
import { getUserFailClosed } from "@/server/session";
import { getSettings } from "@/server/settings";

// An issue's discussion thread for the reader (issue #301), fetched when the
// drawer or sheet first opens and again after every write. Members only — the
// demo mode's anonymous visitor is refused like anyone signed out — and never
// cached, since every answer is shaped for the one viewer asking.

export const dynamic = "force-dynamic";

const numberSchema = z.coerce.number().int().positive().max(1_000_000);
const NO_STORE = { "Cache-Control": "no-store" };

function refuse(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const user = await getUserFailClosed();
  if (!user) return refuse(401, "Sign in to join the discussion.");
  const number = numberSchema.safeParse((await params).number);
  if (!number.success) return refuse(404, "No such issue.");
  if (!(await getSettings()).commentsEnabled) {
    return refuse(403, DISCUSSION_OFF);
  }
  const issueId = await publishedIssueId(number.data);
  if (!issueId) return refuse(404, "No such issue.");

  const payload = await loadThreadPayload(issueId, {
    id: user.id,
    isAdmin: user.isAdmin,
  });
  return NextResponse.json(payload, { headers: NO_STORE });
}
