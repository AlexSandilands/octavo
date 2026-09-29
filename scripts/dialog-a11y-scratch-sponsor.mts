// The a11y gate's sponsor cases need the list's header "Add sponsor" button,
// which an empty list swaps for "Add your first sponsor". On an empty table the
// gate adds one scratch sponsor and removes it again; otherwise it adds none.
import type postgres from "postgres";

const ANCHOR_NAME = "Scratch 130 Anchor Sponsor";

/** Adds the anchor sponsor when there are no sponsors; returns whether it did. */
export async function ensureSponsorRow(sql: postgres.Sql): Promise<boolean> {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from sponsors`;
  if (n > 0) return false;
  await sql`
    insert into sponsors (id, name) values (${crypto.randomUUID()}, ${ANCHOR_NAME})`;
  return true;
}

/** Removes the anchor sponsor, by name so a run that died mid-way is covered. */
export async function removeScratchSponsors(sql: postgres.Sql) {
  await sql`delete from sponsors where name in (${ANCHOR_NAME}, ${"Scratch 130 Sponsor"})`;
}
