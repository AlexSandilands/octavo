import { execFileSync } from "node:child_process";

export type ChangeKind = "feature" | "improvement" | "internal";

export type ChangelogItem = {
  kind: ChangeKind;
  scope: string | null;
  title: string;
  pullRequest: number | null;
  url: string | null;
  /** Commits inside the pull request, oldest first, minus the headline itself. */
  commits: string[];
};

type Commit = {
  hash: string;
  subject: string;
  body: string;
};

const CONVENTIONAL_TITLE =
  /^(feat|fix|perf|refactor|docs|chore|test|build|ci)(?:\(([^)]+)\))?!?:\s*(.+)$/i;

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function latestReleaseTag(target: string): string {
  const tags = git([
    "tag",
    "--merged",
    target,
    "--list",
    "v[0-9]*",
    "--sort=-version:refname",
  ]);
  const tag = tags.split("\n").find(Boolean);
  if (!tag) throw new Error(`No release tag is reachable from ${target}`);
  return tag;
}

export function assertValidRange(from: string, to: string): void {
  for (const ref of [from, to]) {
    git(["rev-parse", "--verify", `${ref}^{commit}`]);
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", from, to], {
      stdio: "ignore",
    });
  } catch {
    throw new Error(`${from} is not an ancestor of ${to}`);
  }
}

/** Author date of a ref, for "since your last update on …" copy. */
export function refDate(ref: string): Date {
  return new Date(git(["log", "-1", "--format=%aI", ref]));
}

function logCommits(range: string, firstParent: boolean): Commit[] {
  const output = git([
    "log",
    ...(firstParent ? ["--first-parent"] : []),
    "--reverse",
    "--format=%H%x1f%s%x1f%b%x1e",
    range,
  ]);
  if (!output) return [];
  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash = "", subject = "", body = ""] = record.split("\x1f");
      return { hash, subject: subject.trim(), body: body.trim() };
    });
}

function githubRepositoryUrl(): string | null {
  let remote: string;
  try {
    remote = git(["remote", "get-url", "origin"]);
  } catch {
    return null;
  }
  const match = remote.match(
    /(?:https?:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/,
  );
  return match?.[1] ? `https://github.com/${match[1]}` : null;
}

function sentenceCase(value: string): string {
  const trimmed = value.trim().replace(/[.\s]+$/, "");
  return trimmed ? trimmed[0]!.toUpperCase() + trimmed.slice(1) : trimmed;
}

function classify(
  type: string | null,
  scope: string | null,
  title: string,
): ChangeKind {
  const internalScopes = ["build", "ci", "docs", "scripts", "test", "tests"];
  if (internalScopes.includes(scope ?? "") || /\bdemo seed\b/i.test(title)) {
    return "internal";
  }
  if (type === "feat") return "feature";
  if (["fix", "perf", "refactor"].includes(type ?? "")) return "improvement";
  return "internal";
}

const MERGE_SUBJECT = /^(merge\b|merge:)/i;
/** Review-round and code-shape commits say nothing a reader would recognise. */
const DEVELOPER_SUBJECT =
  /\b(review (round|feedback|comments)|address review|\w+\.(tsx?|mts|css))\b/i;

/** Plain-language commit subjects from inside a merged branch. */
function branchCommits(merge: Commit, headline: string): string[] {
  const seen = new Set<string>([headline]);
  return logCommits(`${merge.hash}^1..${merge.hash}^2`, false).flatMap(
    (commit) => {
      if (MERGE_SUBJECT.test(commit.subject)) return [];
      const conventional = commit.subject.match(CONVENTIONAL_TITLE);
      const type = conventional?.[1]?.toLowerCase() ?? null;
      const scope = conventional?.[2]?.trim().toLowerCase() || null;
      const subject = sentenceCase(conventional?.[3] ?? commit.subject);
      if (
        type === "refactor" ||
        classify(type, scope, subject) === "internal" ||
        DEVELOPER_SUBJECT.test(subject) ||
        seen.has(subject)
      )
        return [];
      seen.add(subject);
      return [subject];
    },
  );
}

export function collectChanges(
  from: string,
  to: string,
  includeInternal: boolean,
): ChangelogItem[] {
  const repositoryUrl = githubRepositoryUrl();
  return logCommits(`${from}..${to}`, true).flatMap((commit) => {
    const pullRequestMatch = commit.subject.match(
      /^Merge pull request #(\d+)\b/,
    );
    const pullRequest = pullRequestMatch ? Number(pullRequestMatch[1]) : null;
    const mergeTitle = commit.body.split("\n").find((line) => line.trim());
    const rawTitle =
      pullRequest && mergeTitle ? mergeTitle.trim() : commit.subject;
    const conventional = rawTitle.match(CONVENTIONAL_TITLE);
    const type = conventional?.[1]?.toLowerCase() ?? null;
    const scope = conventional?.[2]?.trim().toLowerCase() || null;
    const title = sentenceCase(conventional?.[3] ?? rawTitle);
    const kind = classify(type, scope, title);
    if (kind === "internal" && !includeInternal) return [];

    return [
      {
        kind,
        scope,
        title,
        pullRequest,
        url:
          pullRequest && repositoryUrl
            ? `${repositoryUrl}/pull/${pullRequest}`
            : null,
        commits: pullRequest ? branchCommits(commit, title) : [],
      },
    ];
  });
}

export function compareUrl(from: string, to: string): string | null {
  const repositoryUrl = githubRepositoryUrl();
  const targetCommit = git(["rev-parse", to]);
  return repositoryUrl
    ? `${repositoryUrl}/compare/${encodeURIComponent(from)}...${targetCommit}`
    : null;
}
