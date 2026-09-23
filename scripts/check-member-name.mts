// Posting-name rules (issue #299): the shared validator in
// src/lib/member-name.ts, then the per-account rules member-names.ts adds on
// top — duplicates, shared names and restoring a retired one — against the
// local database with scratch members it removes again.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-member-name.mts
import {
  checkMemberName,
  memberNameKey,
  type MemberNameOptions,
} from "../src/lib/member-name.ts";
import {
  as,
  finish,
  heading,
  names,
  ok,
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
// Retire by posting-free path: add, mark retired as an admin would, re-add.
const kept = await names.addName({ name: "Captain Alex" });
if (kept.ok) {
  const admin = await scratchUser({ isAdmin: true });
  as(admin);
  ok((await names.adminRetireName(kept.name.id)).ok, "a name is retired");
  as(alex);
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
}

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
