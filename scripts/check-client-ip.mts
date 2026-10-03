// The sign-in rate limits' client address (src/lib/client-ip.ts): which
// headers count with and without ORIGIN_AUTH_SECRET. Pure, no server needed.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-client-ip.mts
import { clientIp } from "../src/lib/client-ip.ts";

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) console.log(`  ok — ${msg}`);
  else {
    failures++;
    console.log(`  FAIL — ${msg}`);
  }
};
const h = (init: Record<string, string>) => new Headers(init);
const SECRET = "a".repeat(64);
const forged = {
  "cf-connecting-ip": "198.51.100.7",
  "x-forwarded-for": "198.51.100.8",
  "x-real-ip": "203.0.113.5",
};

console.log("no secret (the demo, local dev)");
ok(
  clientIp(h(forged), undefined) === "203.0.113.5",
  "X-Real-IP, the edge's own",
);
ok(
  clientIp(h({}), undefined) === "unknown",
  "nothing at all → one shared bucket",
);
ok(
  clientIp(h({ "cf-connecting-ip": "198.51.100.7" }), undefined) === "unknown",
  "CF-Connecting-IP alone is never trusted",
);
ok(
  clientIp(h({ "x-forwarded-for": "198.51.100.8" }), undefined) === "unknown",
  "X-Forwarded-For is never read",
);

console.log("secret set (production behind Cloudflare)");
ok(
  clientIp(h({ ...forged, "x-origin-auth": SECRET }), SECRET) ===
    "198.51.100.7",
  "with the secret, CF-Connecting-IP is the client",
);
ok(
  clientIp(
    h({ "x-real-ip": "203.0.113.5", "x-origin-auth": SECRET }),
    SECRET,
  ) === "203.0.113.5",
  "with the secret but no CF-Connecting-IP, X-Real-IP",
);
ok(clientIp(h(forged), SECRET) === null, "no secret sent → refused (null)");
ok(
  clientIp(h({ ...forged, "x-origin-auth": "wrong" }), SECRET) === null,
  "a wrong secret → refused",
);
ok(
  clientIp(h({ ...forged, "x-origin-auth": `${SECRET}x` }), SECRET) === null,
  "a longer secret sharing the prefix → refused",
);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nPASS — client-ip");
