import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";

// Single shared client. In dev, reuse across HMR reloads to avoid exhausting
// connections.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const client = globalForDb.client ?? postgres(env.DATABASE_URL);
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

// drizzle 1.0 takes a config object; `schema` is gone from it (replaced by the
// relational-queries `relations` option, which this app doesn't use — all
// queries go through db.select/insert/update/delete in src/server/).
export const db = drizzle({ client });
