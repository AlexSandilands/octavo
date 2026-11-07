// Draft version history (aboard #51), in memory: when the save path keeps the
// pages it is about to overwrite. No database.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-issue-versions.mts
import {
  countContent,
  HOURLY_MS,
  isLargeRemoval,
  REMOVAL_STREAK_MS,
  SESSION_GAP_MS,
  versionReason,
  type SaveFacts,
} from "../src/lib/issue-versions.ts";
import { makePage, makeBlock } from "../src/lib/blocks.ts";

let failures = 0;
function ok(cond: boolean, label: string) {
  if (cond) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

const now = new Date("2026-11-07T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60 * 1000;

function facts(over: Partial<SaveFacts> = {}): SaveFacts {
  return {
    now,
    lastSavedAt: ago(10 * 1000),
    newestVersionAt: ago(10 * MIN),
    newestCounts: null,
    newestReason: null,
    issueCreatedAt: ago(24 * 60 * MIN),
    revisionKept: false,
    before: { pages: 10, blocks: 40 },
    after: { pages: 10, blocks: 40 },
    ...over,
  };
}

// An ordinary autosave in a sitting keeps nothing.
ok(versionReason(facts()) === null, "a quick follow-on save keeps nothing");

// Session: a pause of 30 minutes or more.
ok(
  versionReason(facts({ lastSavedAt: ago(SESSION_GAP_MS) })) === "session",
  "a save after exactly 30 min keeps a session version",
);
ok(
  versionReason(facts({ lastSavedAt: ago(SESSION_GAP_MS - 1) })) === null,
  "29m59.999s is still the same sitting",
);

// Hourly: no version in the last hour, measured from the issue's creation
// before it has any.
ok(
  versionReason(facts({ newestVersionAt: ago(HOURLY_MS) })) === "hourly",
  "an hour since the newest version keeps an hourly one",
);
ok(
  versionReason(facts({ newestVersionAt: ago(HOURLY_MS - 1) })) === null,
  "just under an hour keeps nothing",
);
ok(
  versionReason(
    facts({ newestVersionAt: null, issueCreatedAt: ago(5 * MIN) }),
  ) === null,
  "a new draft's first saves keep nothing (no empty template version)",
);
ok(
  versionReason(
    facts({ newestVersionAt: null, issueCreatedAt: ago(HOURLY_MS) }),
  ) === "hourly",
  "an hour-old issue with no versions keeps one",
);

// Large removal: two pages, or a quarter of the blocks (at least three).
ok(
  versionReason(facts({ after: { pages: 8, blocks: 40 } })) === "large-removal",
  "dropping two pages keeps a version",
);
ok(
  versionReason(facts({ after: { pages: 9, blocks: 36 } })) === null,
  "dropping one page with a few blocks does not",
);
ok(
  versionReason(facts({ after: { pages: 10, blocks: 30 } })) ===
    "large-removal",
  "dropping 25% of the blocks keeps a version",
);
ok(
  versionReason(facts({ after: { pages: 10, blocks: 31 } })) === null,
  "dropping just under 25% does not",
);
ok(
  !isLargeRemoval({ pages: 2, blocks: 4 }, { pages: 2, blocks: 2 }),
  "two of four blocks is under the three-block floor",
);
ok(
  isLargeRemoval({ pages: 2, blocks: 4 }, { pages: 2, blocks: 1 }),
  "three of four blocks counts",
);
ok(
  !isLargeRemoval({ pages: 3, blocks: 5 }, { pages: 4, blocks: 12 }),
  "growth is never a removal",
);
ok(
  versionReason(
    facts({ lastSavedAt: ago(2 * HOURLY_MS), after: { pages: 1, blocks: 1 } }),
  ) === "large-removal",
  "a large removal outranks the time rules",
);

// Pages deleted one autosave at a time add up against the newest version.
ok(
  versionReason(
    facts({
      newestCounts: { pages: 10, blocks: 40 },
      before: { pages: 9, blocks: 36 },
      after: { pages: 8, blocks: 32 },
    }),
  ) === "large-removal",
  "a second single-page delete since the newest version keeps one",
);
ok(
  versionReason(
    facts({
      newestCounts: { pages: 10, blocks: 40 },
      before: { pages: 10, blocks: 40 },
      after: { pages: 9, blocks: 36 },
    }),
  ) === null,
  "the first single-page delete since the newest version does not",
);

ok(
  versionReason(
    facts({
      newestCounts: { pages: 9, blocks: 36 },
      newestReason: "large-removal",
      newestVersionAt: ago(MIN),
      before: { pages: 8, blocks: 32 },
      after: { pages: 7, blocks: 28 },
    }),
  ) === null,
  "a streak of single-page deletes keeps one version, not one per page",
);
ok(
  versionReason(
    facts({
      newestCounts: { pages: 9, blocks: 36 },
      newestReason: "large-removal",
      newestVersionAt: ago(REMOVAL_STREAK_MS),
      before: { pages: 8, blocks: 32 },
      after: { pages: 7, blocks: 28 },
    }),
  ) === "large-removal",
  "a later streak, after the window, keeps its own version",
);

// The incident: 20 pages deleted one autosave a minute for 12 minutes. The
// pre-deletion copy is kept once and stays; at most one more joins per window.
{
  const kept: { at: number; pages: number; reason: string }[] = [
    { at: -30 * MIN, pages: 20, reason: "session" },
  ];
  for (let i = 1; i <= 12; i += 1) {
    const at = i * MIN;
    const newest = kept[kept.length - 1]!;
    const reason = versionReason({
      now: new Date(now.getTime() + at),
      lastSavedAt: new Date(now.getTime() + at - MIN),
      newestVersionAt: new Date(now.getTime() + newest.at),
      newestCounts: { pages: newest.pages, blocks: newest.pages * 4 },
      newestReason: newest.reason as never,
      issueCreatedAt: ago(24 * 60 * MIN),
      revisionKept: false,
      before: { pages: 21 - i, blocks: (21 - i) * 4 },
      after: { pages: 20 - i, blocks: (20 - i) * 4 },
    });
    if (reason) kept.push({ at, pages: 21 - i, reason });
  }
  ok(
    kept.length <= 3 && kept[0]!.pages === 20,
    `12 single-page deletes a minute apart keep ${kept.length - 1} more version(s), not 12`,
  );
}

// Dedupe: a revision already kept is never kept twice.
ok(
  versionReason(
    facts({ revisionKept: true, after: { pages: 1, blocks: 1 } }),
  ) === null,
  "a revision already kept keeps nothing, even on a large removal",
);

// Counting.
const content = {
  version: 12,
  pages: [makePage("cover-classic"), makePage("blank"), makePage("blank")],
};
content.pages[1]!.blocks.push(makeBlock("text"), makeBlock("heading"));
const counted = countContent(content);
ok(
  counted.pages === 3 &&
    counted.blocks === content.pages.reduce((n, p) => n + p.blocks.length, 0),
  "countContent counts pages and every page's blocks",
);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall version-history checks passed");
