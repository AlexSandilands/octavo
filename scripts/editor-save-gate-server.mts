import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// Local-only production server; test storage/email settings cannot contact providers.
export function gateServer(port: number) {
  const base = `http://localhost:${port}`;
  let child: ChildProcess | undefined;
  const runtime = {
    ...process.env,
    AUTH_URL: base,
    APP_URL: base,
    R2_ACCOUNT_ID: "test",
    R2_ACCESS_KEY_ID: "test",
    R2_SECRET_ACCESS_KEY: "test",
    R2_BUCKET: "test",
    R2_PUBLIC_URL: `${base}/test-images`,
    EMAIL_API_KEY: "test",
    EMAIL_FROM: "test@example.test",
    SENTRY_DSN: undefined,
    NEXT_PUBLIC_SENTRY_DSN: undefined,
  };
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    child = undefined;
  };
  const start = async () => {
    child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
      {
        env: runtime,
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let errors = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      errors = (errors + chunk.toString()).slice(-3000);
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${errors}`);
      if (
        await fetch(`${base}/api/health`)
          .then((r) => r.ok)
          .catch(() => false)
      )
        return;
      await delay(100);
    }
    throw new Error(`Server did not become healthy: ${errors}`);
  };
  const rebuild = async () => {
    const before = await readFile(".next/BUILD_ID", "utf8");
    const actionsBefore = JSON.parse(
      await readFile(".next/server/server-reference-manifest.json", "utf8"),
    );
    await stop();
    await mkdir(".data", { recursive: true });
    const backup = `.data/i245-build-${crypto.randomUUID()}`;
    await rename(".next", backup);
    try {
      const buildEnv = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !/^(DATABASE_URL|AUTH_|APP_URL|R2_|EMAIL_|SENTRY_|NEXT_PUBLIC_SENTRY_|NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)/.test(
              key,
            ),
        ),
      );
      const build = spawn("npm", ["run", "build"], {
        env: { ...buildEnv, NODE_ENV: "production" },
        stdio: "inherit",
      });
      const [code] = await once(build, "exit");
      assert.equal(code, 0, "build B succeeds");
      assert.notEqual(
        await readFile(".next/BUILD_ID", "utf8"),
        before,
        "build IDs differ",
      );
      const actionsAfter = JSON.parse(
        await readFile(".next/server/server-reference-manifest.json", "utf8"),
      );
      assert.notDeepEqual(
        Object.keys(actionsAfter.node).sort(),
        Object.keys(actionsBefore.node).sort(),
        "Server Action IDs really changed",
      );
    } catch (error) {
      await rm(".next", { recursive: true, force: true });
      await rename(backup, ".next");
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
    await start();
  };
  return { base, start, stop, rebuild, runtime };
}
