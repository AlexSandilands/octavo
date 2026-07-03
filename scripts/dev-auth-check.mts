// Dev-only helper for verifying the magic-link flow (issue #3). Upserts a
// test member and prints auth-related table counts. Not part of the app.
// Run: npx tsx scripts/dev-auth-check.mts [--cleanup]
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const TEST_EMAIL = "member@example.com";

if (process.argv.includes("--cleanup")) {
  await sql`delete from users where email = ${TEST_EMAIL}`;
  console.log("test member removed");
} else {
  await sql`
    insert into users (id, email, name) values (${crypto.randomUUID()}, ${TEST_EMAIL}, 'Test Member')
    on conflict (email) do nothing`;
  console.log("test member present:", TEST_EMAIL);
}

const [counts] = await sql`
  select
    (select count(*) from users) as users,
    (select count(*) from sessions) as sessions,
    (select count(*) from verification_tokens) as tokens`;
console.log(counts);
await sql.end();
