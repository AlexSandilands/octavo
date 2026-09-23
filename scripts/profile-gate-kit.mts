// What the halves of dev-profile-gate.mts share (issue #300).
import type { Browser, Page } from "playwright";
import type postgres from "postgres";

export type Member = {
  id: string;
  email: string;
  token: string;
  isAdmin: boolean;
};

export type ProfileKit = {
  browser: Browser;
  base: string;
  sql: postgres.Sql;
  out: string;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
  member: (
    label: string,
    opts?: { admin?: boolean; name?: string | null },
  ) => Promise<Member>;
  nameRow: (userId: string, name: string) => Promise<string>;
  as: (m: Member | null) => void;
  upload: (
    m: Member | null,
    nameId: string,
    bytes: Buffer,
    opts?: { type?: string; filename?: string; origin?: string | null },
  ) => Promise<{ status: number; reason: string }>;
  smallJpeg: Buffer;
  /** /profile as that member, at a viewport width. */
  open: (m: Member, width?: number) => Promise<Page>;
  /** Whether the Names section's live region says `text` within 10s. */
  heard: (page: Page, text: string) => Promise<boolean>;
};
