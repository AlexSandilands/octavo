// Grant admin to an email, creating the user if needed. Idempotent — safe to
// re-run. This is how the first admin gets in on a fresh database (local or
// production), since /admin is gated and only an admin can manage members.
//
// Run: npm run db:admin -- you@example.com   (or set ADMIN_EMAIL)
// Production (Railway): railway run npm run db:admin -- you@example.com
import postgres from "postgres";

// Load .env.local when present (local dev); in production DATABASE_URL is in
// the environment already.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // fine — env may be set in the shell
}

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) {
    throw new Error(
      "Usage: npm run db:admin -- you@example.com  (or set ADMIN_EMAIL)",
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { max: 1 });
  const [row] = await sql`
    insert into users (id, email, is_admin)
    values (${crypto.randomUUID()}, ${email}, true)
    on conflict (email) do update set is_admin = true
    returning email`;
  if (!row) throw new Error("Insert returned no row.");
  console.log(`Admin ready: ${row.email} — sign in at /signin.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
