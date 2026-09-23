// The members, issues and names check-comments-module.mts works with, and its
// posting helpers — shared with its account section. Importing this creates
// the scratch rows; the main script removes them.
import type { Scratch } from "./harness.mts";

const h = await import("./harness.mts");
const { as, names, thread } = h;

const admin = await h.scratchUser({ name: "Check Admin", isAdmin: true });
const alice = await h.scratchUser({ name: "Alice Check" });
const bob = await h.scratchUser({ name: "Bob Check" });
// Takes the refused posts and the policy replies, so no one member's post
// budget runs out mid-check.
const carol = await h.scratchUser({ name: "Carol Check" });
const issue = await h.scratchIssue(true);
const draft = await h.scratchIssue(false);

async function nameFor(user: Scratch, name: string) {
  as(user);
  const result = await names.addName({ name });
  if (!result.ok) throw new Error(`addName ${name}: ${result.reason}`);
  return result.name.id;
}
const aliceName = await nameFor(alice, "Alice Aye");
const bobName = await nameFor(bob, "Bob Bee");
const adminName = await nameFor(admin, "Chair Person");
const carolName = await nameFor(carol, "Carol Sea");

async function post(
  user: Scratch,
  input: Parameters<typeof thread.createComment>[0],
) {
  as(user);
  return thread.createComment(input);
}
async function mustPost(
  user: Scratch,
  input: Parameters<typeof thread.createComment>[0],
) {
  const result = await post(user, input);
  if (!result.ok) throw new Error(`post: ${result.reason}`);
  return result.id;
}

export {
  admin,
  alice,
  bob,
  carol,
  issue,
  draft,
  nameFor,
  aliceName,
  bobName,
  adminName,
  carolName,
  post,
  mustPost,
};
export type CommentsFixtures = typeof import("./comments-module-fixtures.mts");
