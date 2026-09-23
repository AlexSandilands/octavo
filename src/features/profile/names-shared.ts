// What the profile's name components share (issue #300).

export type NameRules = { reserved: string[]; accountName: string | null };

/** Speaks a result; `shared` appends the shared-name note. */
export type Announce = (message: string, shared?: boolean) => void;

export const SHARED_NOTE =
  "Another member also uses this name. That’s fine — you could add an initial so people can tell you apart.";
