import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";

// Single shared client. In dev, reuse across HMR reloads to avoid exhausting
// connections.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

// Created lazily on first query, not at import. `next build` evaluates this
// module while collecting page data, and eager creation would read
// env.DATABASE_URL then — forcing the secret to be a build arg (issue #67).
// Deferring means DATABASE_URL is validated at first use (runtime) instead.
let instance: ReturnType<typeof drizzle> | undefined;
function getDb() {
  if (instance) return instance;
  const client = globalForDb.client ?? postgres(env.DATABASE_URL);
  if (process.env.NODE_ENV !== "production") globalForDb.client = client;
  // drizzle 1.0 takes a config object; `schema` is gone from it (replaced by the
  // relational-queries `relations` option, which this app doesn't use — all
  // queries go through db.select/insert/update/delete in src/server/).
  instance = drizzle({ client });
  return instance;
}

// A stable `db` handle that initialises the client on first property access,
// so call sites keep using `db.select()/execute()/…` unchanged (lazy init for
// issue #67 — see getDb above).
const boundMethods = new Map<PropertyKey, unknown>();
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  // Report the real prototype chain so `db instanceof PgDatabase` and
  // drizzle-orm's `is()` (which walks prototypes / uses instanceof, never the
  // get trap) recognise the handle. The empty target is extensible, so a
  // custom getPrototypeOf is allowed by the Proxy invariants.
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getDb());
  },
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    if (typeof value !== "function") return value;
    // Bind once per prop and cache, so `db.select === db.select` holds and we
    // don't allocate a fresh bound function on every access. Safe because
    // getDb() is memoised, so `real` (and thus each bound method) is stable.
    let bound = boundMethods.get(prop);
    if (!bound) {
      bound = value.bind(real);
      boundMethods.set(prop, bound);
    }
    return bound;
  },
});
