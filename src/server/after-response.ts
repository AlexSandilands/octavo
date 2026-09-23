import "server-only";
import { after } from "next/server";

// Work a member shouldn't wait for — the reply and report emails — runs once
// the response has gone (`after`), so a slow mail provider never holds up a
// post. Outside a request (the in-process module checks) there is no response
// to wait for, and the task runs in line.
export async function afterResponse(task: () => Promise<void>): Promise<void> {
  try {
    after(task);
  } catch {
    await task();
  }
}
