import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  assertValidRange,
  collectChanges,
  compareUrl,
  latestReleaseTag,
  refDate,
} from "./git.mts";
import { draftNotes, parseNotes } from "./notes.mts";
import { renderChangelogPage } from "./template.mts";

const refSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^(?!-)[A-Za-z0-9_./-]+$/, "must be a simple Git ref");

const argsSchema = z.object({
  from: refSchema.optional(),
  to: refSchema.default("HEAD"),
  out: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  product: z.string().trim().min(1).max(80).default("Octavo"),
  title: z.string().trim().min(1).max(140).optional(),
  subject: z.string().trim().min(1).max(180).optional(),
  includeInternal: z.boolean().default(false),
  open: z.boolean().default(true),
});

type RawArgs = z.input<typeof argsSchema>;

function usage(): string {
  return `usage: npm run changelog -- [options]

Generates an editable HTML email from the latest release tag to HEAD and opens it.

  --from <ref>          start at this release/ref instead of the latest tag
  --to <ref>            end at this ref (default: HEAD)
  --out <file.html>     output path (default: .data/changelog-email-*.html)
  --notes <file.md>     highlights prose (default: .data/changelog-notes-*.md;
                        drafted from the pull requests when it does not exist)
  --product <name>      product name in the email (default: Octavo)
  --title <text>        email headline
  --subject <text>      Proton composer subject
  --include-internal    include docs, chores, tests and CI changes
  --no-open             write the file without opening a browser
  --help                show this help`;
}

function optionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`${option} needs a value`);
  return value;
}

function parseArgs(argv: string[]): RawArgs | null {
  const values: RawArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]!;
    if (option === "--help" || option === "-h") return null;
    if (option === "--include-internal") values.includeInternal = true;
    else if (option === "--no-open") values.open = false;
    else if (
      [
        "--from",
        "--to",
        "--out",
        "--notes",
        "--product",
        "--title",
        "--subject",
      ].includes(option)
    ) {
      const value = optionValue(argv, index, option);
      index += 1;
      if (option === "--from") values.from = value;
      else if (option === "--to") values.to = value;
      else if (option === "--out") values.out = value;
      else if (option === "--notes") values.notes = value;
      else if (option === "--product") values.product = value;
      else if (option === "--title") values.title = value;
      else values.subject = value;
    } else {
      throw new Error(`Unknown option: ${option}\n\n${usage()}`);
    }
  }
  return values;
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-|-$/g, "");
}

function formattedDate(value: Date): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function openBrowser(path: string): void {
  const command =
    process.platform === "darwin"
      ? { file: "open", args: [path] }
      : process.platform === "win32"
        ? { file: "explorer.exe", args: [path] }
        : { file: "xdg-open", args: [path] };
  const child = spawn(command.file, command.args, {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => {
    console.warn(`Could not open a browser automatically. Open ${path}`);
  });
  child.unref();
}

function main(): void {
  const raw = parseArgs(process.argv.slice(2));
  if (!raw) {
    console.log(usage());
    return;
  }
  const options = argsSchema.parse(raw);
  const from = options.from ?? latestReleaseTag(options.to);
  assertValidRange(from, options.to);
  const changes = collectChanges(from, options.to, options.includeInternal);
  if (!changes.length) {
    throw new Error(
      `No email-ready changes found from ${from} to ${options.to}. Try --include-internal.`,
    );
  }

  const date = new Date();
  const title = options.title ?? `What’s new in ${options.product}`;
  const subject =
    options.subject ?? `${options.product} update — ${formattedDate(date)}`;
  const range = `${slug(from)}-to-${slug(options.to)}`;
  const outPath = resolve(options.out ?? `.data/changelog-email-${range}.html`);
  const notesPath = resolve(
    options.notes ?? `.data/changelog-notes-${range}.md`,
  );
  mkdirSync(dirname(outPath), { recursive: true });
  mkdirSync(dirname(notesPath), { recursive: true });

  // The prose lives in a notes file the author edits between runs; the first
  // run drafts it from the pull requests so there is always something to render.
  const notesDrafted = !existsSync(notesPath);
  if (notesDrafted) writeFileSync(notesPath, draftNotes(changes));
  let sections = parseNotes(readFileSync(notesPath, "utf8"));
  if (!sections.length) sections = parseNotes(draftNotes(changes));

  const html = renderChangelogPage({
    product: options.product,
    title,
    subject,
    from,
    to: options.to,
    date,
    sinceDate: refDate(from),
    changes,
    sections,
    compareUrl: compareUrl(from, options.to),
    notesPath,
    notesDrafted,
  });
  writeFileSync(outPath, html);
  console.log(
    `Generated ${changes.length} email-ready changes from ${from} to ${options.to}`,
  );
  console.log(
    notesDrafted
      ? `Drafted highlights in ${notesPath} — write the client-facing wording there and re-run`
      : `Highlights read from ${notesPath}`,
  );
  console.log(`Wrote ${outPath}`);
  if (options.open) {
    openBrowser(outPath);
    console.log("Opened the editable preview in your browser");
  }
}

try {
  main();
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.issues.map((issue) => issue.message).join("\n"));
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}
