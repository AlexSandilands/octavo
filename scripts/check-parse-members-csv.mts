// Dev-only: exercises the members CSV parser (issue #94) against the shapes a
// club's spreadsheet export actually produces — split first/last name columns,
// underscored and hyphenated headers, semicolon and tab separators, headerless
// files, and headers we don't recognise at all. No browser, DB or dev server.
// Run: npx tsx scripts/check-parse-members-csv.mts
import { parseMembersCsv } from "../src/lib/parse-members-csv.ts";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// Compact assertion: parse `csv` and compare the members to `expected` pairs.
const expect = (
  label: string,
  csv: string,
  expected: [email: string, name: string | null][],
  counts?: { invalid?: number; duplicates?: number },
) => {
  const parsed = parseMembersCsv(csv);
  const got = parsed.members.map((m) => [m.email, m.name] as const);
  ok(
    JSON.stringify(got) === JSON.stringify(expected),
    `${label} → ${JSON.stringify(got)}`,
  );
  if (counts?.invalid !== undefined) {
    ok(
      parsed.invalid === counts.invalid,
      `${label} → ${parsed.invalid} invalid (want ${counts.invalid})`,
    );
  }
  if (counts?.duplicates !== undefined) {
    ok(
      parsed.duplicates === counts.duplicates,
      `${label} → ${parsed.duplicates} duplicate (want ${counts.duplicates})`,
    );
  }
};

console.log("\n— recognised headers —");
expect("name,email", "Name,Email\nAda Lovelace,ada@example.com", [
  ["ada@example.com", "Ada Lovelace"],
]);
expect("reversed column order", "Email,Full Name\nada@example.com,Ada", [
  ["ada@example.com", "Ada"],
]);
expect("email only", "Email\nada@example.com", [["ada@example.com", null]]);
for (const spelling of [
  "E-mail",
  "e_mail",
  "MAIL",
  "Email Address",
  "email_address",
  "E-mail Address",
]) {
  expect(
    `email header "${spelling}"`,
    `Name,${spelling}\nAda,ada@example.com`,
    [["ada@example.com", "Ada"]],
  );
}
for (const spelling of [
  "Member",
  "Member Name",
  "Display Name",
  "Contact Name",
  "full_name",
  "FULL NAME",
]) {
  expect(
    `name header "${spelling}"`,
    `${spelling},Email\nAda,ada@example.com`,
    [["ada@example.com", "Ada"]],
  );
}

console.log("\n— split first/last name columns —");
expect(
  "First Name,Last Name,Email",
  "First Name,Last Name,Email\nAda,Lovelace,ada@example.com\nAlan,Turing,alan@example.com",
  [
    ["ada@example.com", "Ada Lovelace"],
    ["alan@example.com", "Alan Turing"],
  ],
  { invalid: 0 },
);
expect(
  "surname/given name spellings",
  "Given Name,Surname,E-mail\nAda,Lovelace,ada@example.com",
  [["ada@example.com", "Ada Lovelace"]],
);
expect(
  "family name, columns out of order",
  "Email,Family Name,First Name\nada@example.com,Lovelace,Ada",
  [["ada@example.com", "Ada Lovelace"]],
);
expect(
  "one half of the name missing",
  "First Name,Last Name,Email\nAda,,ada@example.com\n,Turing,alan@example.com\n,,grace@example.com",
  [
    ["ada@example.com", "Ada"],
    ["alan@example.com", "Turing"],
    ["grace@example.com", null],
  ],
);
expect(
  "full name column wins, first/last fills the gaps",
  "Name,First Name,Last Name,Email\nAda Lovelace,Ada,Lovelace,ada@example.com\n,Alan,Turing,alan@example.com",
  [
    ["ada@example.com", "Ada Lovelace"],
    ["alan@example.com", "Alan Turing"],
  ],
);

console.log("\n— header normalisation —");
expect(
  "underscores and hyphens",
  "first_name,last-name,email_address\nAda,Lovelace,ada@example.com",
  [["ada@example.com", "Ada Lovelace"]],
);
expect(
  "padding and mixed case",
  "  First   Name , LAST NAME ,  E-Mail  \nAda,Lovelace,ada@example.com",
  [["ada@example.com", "Ada Lovelace"]],
);

console.log("\n— unrecognised headers (inference on the first data row) —");
expect(
  "unknown headers both columns",
  "Membre,Courriel\nAda Lovelace,ada@example.com\nAlan Turing,alan@example.com",
  [
    ["ada@example.com", "Ada Lovelace"],
    ["alan@example.com", "Alan Turing"],
  ],
  { invalid: 0 },
);
expect(
  "unknown email header, known name header",
  "Surname,Contact Point\nLovelace,ada@example.com",
  [["ada@example.com", "Lovelace"]],
  { invalid: 0 },
);
expect(
  "a recognised header row is never imported as data",
  "Membre,Courriel\nAda,ada@example.com",
  [["ada@example.com", "Ada"]],
  { invalid: 0 },
);

console.log("\n— delimiters —");
expect(
  "semicolons",
  "Name;Email\nAda Lovelace;ada@example.com\nAlan Turing;alan@example.com",
  [
    ["ada@example.com", "Ada Lovelace"],
    ["alan@example.com", "Alan Turing"],
  ],
  { invalid: 0 },
);
expect(
  "semicolons, single-word names (no spaces to tell the columns apart)",
  "First Name;Last Name;Email\nAda;Lovelace;ada@example.com",
  [["ada@example.com", "Ada Lovelace"]],
  { invalid: 0 },
);
expect(
  "tabs",
  "First Name\tLast Name\tEmail\nAda\tLovelace\tada@example.com",
  [["ada@example.com", "Ada Lovelace"]],
  { invalid: 0 },
);
expect(
  "tabs, no header",
  "Ada Lovelace\tada@example.com",
  [["ada@example.com", "Ada Lovelace"]],
  { invalid: 0 },
);
expect(
  "a comma inside a semicolon file stays part of the name",
  "Name;Email\nLovelace, Ada;ada@example.com",
  [["ada@example.com", "Lovelace, Ada"]],
);

console.log("\n— headerless files —");
expect(
  "bare addresses",
  "ada@example.com\nalan@example.com",
  [
    ["ada@example.com", null],
    ["alan@example.com", null],
  ],
  { invalid: 0 },
);
expect(
  "name then address",
  "Ada Lovelace,ada@example.com\nAlan Turing,alan@example.com",
  [
    ["ada@example.com", "Ada Lovelace"],
    ["alan@example.com", "Alan Turing"],
  ],
  { invalid: 0 },
);
expect(
  "address then name",
  "ada@example.com,Ada Lovelace",
  [["ada@example.com", "Ada Lovelace"]],
  { invalid: 0 },
);

console.log("\n— messes, counts and edge cases —");
expect(
  "quoted commas, embedded quotes, CRLF and a BOM",
  '﻿Name,Email\r\n"Lovelace, Ada",ada@example.com\r\n"Alan ""Al"" Turing",alan@example.com\r\n',
  [
    ["ada@example.com", "Lovelace, Ada"],
    ["alan@example.com", 'Alan "Al" Turing'],
  ],
  { invalid: 0 },
);
expect(
  "invalid and duplicate rows are counted, not imported",
  "First Name,Last Name,Email\nAda,Lovelace,ada@example.com\nAda,Lovelace,ADA@example.com\nBroken,Row,not-an-address\n",
  [["ada@example.com", "Ada Lovelace"]],
  { invalid: 1, duplicates: 1 },
);
expect("empty file", "", []);
expect("blank lines only", "\n\n  \n", []);
expect("header row with no data", "First Name,Last Name,Email", [], {
  invalid: 0,
});
expect(
  "leading junk rows before the first address",
  "Club export 2026\nFirst Name,Last Name,Email\nAda,Lovelace,ada@example.com",
  [["ada@example.com", "Ada Lovelace"]],
  { invalid: 1 },
);

console.log("\nall checks passed");
