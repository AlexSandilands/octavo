// Posting-name rules (issue #299): the shared validator in
// src/lib/member-name.ts, then the per-account rules member-names.ts adds on
// top — duplicates, shared names, restoring a retired one, and an admin's
// retirement that sticks — against the local database with scratch members it
// removes again.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-member-name.mts
import {
  checkMemberName,
  memberNameKey,
  type MemberNameOptions,
} from "../src/lib/member-name.ts";
import { eq } from "drizzle-orm";
import {
  as,
  db,
  finish,
  heading,
  names,
  ok,
  schema,
  scratchUser,
} from "./fixtures/discussion/harness.mts";

const opts: MemberNameOptions = {
  reserved: ["The Harbour Review", "Harbour Sailing Club"],
};
const refused = (raw: string, o = opts) => !checkMemberName(raw, o).ok;
const accepted = (raw: string, o = opts) => checkMemberName(raw, o).ok;

heading("normalising");
const tidy = checkMemberName("  Ｍary\t  O’Brien  ", opts);
ok(
  tidy.ok && tidy.name === "Mary O’Brien",
  "NFKC, trimmed, inner whitespace collapsed",
);
ok(
  tidy.ok && tidy.key === "mary o’brien",
  "the key is the normalised form, lower-cased",
);
ok(
  memberNameKey("MARY  o’brien") === memberNameKey("mary o’brien"),
  "case/space variants share a key",
);

heading("length");
ok(refused("J"), "1 character refused");
ok(accepted("Jo"), "2 characters accepted");
ok(accepted("A".repeat(40)), "40 characters accepted");
ok(refused("A".repeat(41)), "41 characters refused");
ok(refused("   "), "blank refused");

heading("characters");
ok(accepted("Anne-Marie St. John"), "hyphens, full stops, spaces accepted");
ok(accepted("D'Arcy O’Neill"), "both apostrophes accepted");
ok(accepted("José Müller"), "accented letters accepted");
ok(accepted("Zoë Ångström"), "combining marks / precomposed letters accepted");
ok(accepted("Владимир"), "Cyrillic accepted");
ok(accepted("山田太郎"), "CJK accepted");
ok(accepted("J.R. Hartley"), "initials accepted");
ok(refused("Agent 007"), "digits refused");
ok(refused("bob@example"), "@ refused");
ok(refused("www.example.com"), "a web address refused");
ok(refused("https://x.io"), "a URL refused");
ok(refused("Sunny 😀"), "emoji refused");
ok(refused("Tab\u0000Name"), "control characters refused");
ok(refused("Line\u0007Bell"), "a bell character refused");
ok(refused("--"), "punctuation with no letters refused");

heading("reserved words");
for (const word of [
  "Former member",
  "comment removed",
  "ANONYMOUS",
  "Admin",
  "Administrator",
  "Moderator",
  "Committee",
  "Editor",
]) {
  ok(refused(word), `"${word}" refused`);
}
ok(refused("the harbour review"), "the magazine name (from settings) refused");
ok(refused("Harbour  Sailing Club"), "the club name (from settings) refused");
ok(
  accepted("Admiral Jones"),
  "a name merely containing a reserved word accepted",
);

heading("profanity");
ok(refused("Fuck Face"), "a profanity hit refused");
ok(refused("Sh1t Head"), "a l33t variant refused");
ok(
  refused("Dick Turner"),
  '"Dick Turner" refused for an account without "Dick"',
);
ok(
  accepted("Dick Turner", { ...opts, accountName: "Richard Dick Turner" }),
  '"Dick Turner" allowed when the account\'s users.name contains "Dick"',
);
ok(
  refused("Dick Shit", { ...opts, accountName: "Dick Turner" }),
  "the allowance covers only words in the account's name",
);
ok(
  accepted("Mary Dickinson", { ...opts, skipProfanity: true }),
  "the admin path skips the filter",
);
ok(
  refused("Admin", { ...opts, skipProfanity: true }),
  "the admin path keeps every other rule",
);
ok(accepted("Scunthorpe"), "Scunthorpe-style false positive avoided");

heading("per account (local database)");
const alex = await scratchUser({ name: "Alex Dick" });
const sam = await scratchUser({ name: "Sam Other" });

as(alex);
const first = await names.addName({ name: "Alex Smith" });
ok(
  first.ok && !first.sharedWithAnotherMember,
  "a new name is added, not flagged",
);
const variant = await names.addName({ name: "  ALEX   smith " });
ok(
  !variant.ok && variant.reason === "You already have this name.",
  "a case/space variant on the same account is refused",
);
const dick = await names.addName({ name: "Dick Turner" });
ok(
  dick.ok,
  '"Dick Turner" allowed through the module for an account named "Alex Dick"',
);

as(sam);
const shared = await names.addName({ name: "alex smith" });
ok(shared.ok, "the same name on another account is allowed");
ok(
  shared.ok && shared.sharedWithAnotherMember,
  "…and flagged sharedWithAnotherMember",
);
const samDick = await names.addName({ name: "Dick Turner" });
ok(!samDick.ok, '"Dick Turner" refused for an account without "Dick"');

as(alex);
const second = await names.addName({ name: "Alex S." });
ok(second.ok, "a second name on the account");
if (second.ok) {
  const removed = await names.removeName(second.name.id);
  ok(removed.ok && removed.outcome === "deleted", "an unused name is deleted");
}
// A member's own retirement is what removeName does to a name with comments;
// set here directly, so no comment is needed.
const retireAsMember = (nameId: string) =>
  db
    .update(schema.memberNames)
    .set({ retiredAt: new Date(), retiredBy: "member" })
    .where(eq(schema.memberNames.id, nameId));
const kept = await names.addName({ name: "Captain Alex" });
if (kept.ok) {
  await retireAsMember(kept.name.id);
  const listed = await names.listMyNames();
  ok(
    !listed.some((n) => n.id === kept.name.id),
    "a retired name leaves the picker",
  );
  const restored = await names.addName({ name: "captain  ALEX" });
  ok(
    restored.ok && restored.name.id === kept.name.id,
    "re-adding a retired own name restores the same row",
  );
  ok(
    restored.ok && restored.name.name === "captain ALEX",
    "…under the newly entered spelling",
  );
  await retireAsMember(kept.name.id);
  const onto = first.ok
    ? await names.renameName({ nameId: first.name.id, name: "Captain Alex" })
    : undefined;
  ok(
    onto &&
      !onto.ok &&
      onto.reason === "You retired that name. Add it again instead.",
    "renaming onto one of your retired names says so",
  );
}

heading("an admin's retirement sticks");
// A fresh member: the account above has spent most of its hourly budget.
const admin = await scratchUser({ isAdmin: true });
const rae = await scratchUser({ name: "Rae Check" });
const ADMIN_RETIRED = /An admin has retired this name/;
as(rae);
const raeFirst = await names.addName({ name: "Rae First" });
const barred = await names.addName({ name: "Rae Barred" });
if (raeFirst.ok && barred.ok) {
  as(admin);
  ok((await names.adminRetireName(barred.name.id)).ok, "an admin retires it");
  ok(
    !(await names.adminRetireName(barred.name.id)).ok,
    "…once: retiring it again is refused",
  );
  as(rae);
  ok(
    !(await names.listMyNames()).some((n) => n.id === barred.name.id),
    "it leaves the member's picker",
  );
  const readd = await names.addName({ name: "rae  BARRED" });
  ok(
    !readd.ok && ADMIN_RETIRED.test(readd.reason),
    "the member can't add it back",
  );
  const onto = await names.renameName({
    nameId: raeFirst.name.id,
    name: "Rae Barred",
  });
  ok(
    !onto.ok && ADMIN_RETIRED.test(onto.reason),
    "…nor rename another of their names onto it",
  );
  as(sam);
  const elsewhere = await names.addName({ name: "Rae Barred" });
  ok(elsewhere.ok, "another account may still use the same name");

  as(admin);
  const reworded = await names.adminRenameName({
    nameId: barred.name.id,
    name: "Rae Bee",
  });
  ok(
    reworded.ok && reworded.name.name === "Rae Bee",
    "an admin can reword a retired name",
  );
  const [row] = await db
    .select()
    .from(schema.memberNames)
    .where(eq(schema.memberNames.id, barred.name.id));
  ok(
    row?.retiredAt !== null && row?.retiredBy === "admin",
    "…and it stays retired by an admin",
  );
  as(rae);
  const newWording = await names.addName({ name: "Rae Bee" });
  ok(
    !newWording.ok && ADMIN_RETIRED.test(newWording.reason),
    "…the block following the new wording",
  );
}
const own = await names.addName({ name: "Rae Own" });
if (own.ok) {
  await retireAsMember(own.name.id);
  as(admin);
  ok(
    (await names.adminRetireName(own.name.id)).ok,
    "an admin can make a member's own retirement stick",
  );
  as(rae);
  const back = await names.addName({ name: "Rae Own" });
  ok(!back.ok && ADMIN_RETIRED.test(back.reason), "…so it can't be re-added");
}
as(null);
const outsider = await names.adminRetireName("x").catch(() => "threw");
ok(outsider === "threw", "a signed-out adminRetireName throws");

heading("the five-name cap");
const cap = await scratchUser({ name: "Cap Member" });
as(cap);
for (const n of ["Ann One", "Ann Two", "Ann Three", "Ann Four", "Ann Five"]) {
  await names.addName({ name: n });
}
const sixth = await names.addName({ name: "Ann Six" });
ok(!sixth.ok && /up to 5/.test(sixth.reason), "a sixth live name is refused");

heading("rate limit (names: 10 an hour)");
const busy = await scratchUser({ name: "Busy Member" });
as(busy);
let last: Awaited<ReturnType<typeof names.addName>> | undefined;
for (let i = 0; i < 11; i++) last = await names.addName({ name: "x" });
ok(
  last && !last.ok && /going a little fast/.test(last.reason),
  "the 11th change in an hour is slowed down",
);

await finish();
