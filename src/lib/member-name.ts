import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

// The one definition of an acceptable posting name (issue #299), shared by the
// profile form in the browser and the server module, as member-email.ts is.
// Framework-free: the magazine and club names arrive as parameters.

export const MEMBER_NAME_MIN = 2;
export const MEMBER_NAME_MAX = 40;

export type MemberNameCheck =
  | { ok: true; name: string; key: string }
  | { ok: false; reason: string };

export type MemberNameOptions = {
  /** The magazine and club names from settings — reserved like the words below. */
  reserved: string[];
  /** The account's `users.name`: a word in it may trip the profanity filter
   *  ("Dick", "Fanny") and still be allowed. */
  accountName?: string | null;
  /** The admin path: every rule but the profanity filter. */
  skipProfanity?: boolean;
};

const RESERVED = [
  "Former member",
  "Comment removed",
  "Anonymous",
  "Admin",
  "Administrator",
  "Moderator",
  "Committee",
  "Editor",
];

// Letters of any script, combining marks, spaces, apostrophes, hyphens and
// full stops — which also keeps a name safe in an email subject.
const ALLOWED = /^[\p{L}\p{M} '’.-]+$/u;
// "bit.ly": a full stop between two runs of letters reads as a web address,
// while initials ("J.R. Hartley") stay allowed.
const WEB_ADDRESS = /\p{L}{2,}\.\p{L}{2,}/u;

/** NFKC, trimmed, inner whitespace collapsed: the form a name is stored in. */
export function normaliseMemberName(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** What "the same name" means: the normalised form, lower-cased. */
export function memberNameKey(raw: string): string {
  return normaliseMemberName(raw).toLowerCase();
}

let matcher: RegExpMatcher | undefined;
function profanity(): RegExpMatcher {
  matcher ??= new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  return matcher;
}

// Words of the name, with their spans, so a match can be traced to whole words.
function words(name: string): { word: string; start: number; end: number }[] {
  return [...name.matchAll(/[\p{L}\p{M}'’]+/gu)].map((m) => ({
    word: m[0].toLowerCase(),
    start: m.index,
    end: m.index + m[0].length - 1,
  }));
}

// Profane unless every flagged word also appears in the account's own name.
function isProfane(name: string, accountName: string | null | undefined) {
  const matches = profanity().getAllMatches(name);
  if (matches.length === 0) return false;
  const allowed = new Set(
    words(normaliseMemberName(accountName ?? "")).map((w) => w.word),
  );
  const nameWords = words(name);
  return matches.some((match) => {
    const hit = nameWords.filter(
      (w) => w.start <= match.endIndex && w.end >= match.startIndex,
    );
    return hit.length === 0 || hit.some((w) => !allowed.has(w.word));
  });
}

export function checkMemberName(
  raw: string,
  options: MemberNameOptions,
): MemberNameCheck {
  const name = normaliseMemberName(raw);
  const length = [...name].length;
  if (length < MEMBER_NAME_MIN) {
    return { ok: false, reason: "Use at least 2 characters." };
  }
  if (length > MEMBER_NAME_MAX) {
    return { ok: false, reason: "Use 40 characters or fewer." };
  }
  if (!ALLOWED.test(name) || !/\p{L}/u.test(name)) {
    return {
      ok: false,
      reason:
        "Use letters, spaces, apostrophes, hyphens and full stops only — no numbers or symbols.",
    };
  }
  if (WEB_ADDRESS.test(name)) {
    return { ok: false, reason: "A name can't look like a web address." };
  }
  const key = memberNameKey(name);
  const reserved = [...RESERVED, ...options.reserved].map(memberNameKey);
  if (reserved.includes(key)) {
    return { ok: false, reason: "That name is reserved. Choose another." };
  }
  if (!options.skipProfanity && isProfane(name, options.accountName)) {
    return {
      ok: false,
      reason:
        "That name can't be used. If it is your real name, ask an admin to set it for you.",
    };
  }
  return { ok: true, name, key };
}
