// Module hooks for the discussion checks (issue #299): an import of
// src/server/session.ts from app code resolves to session-stub.mts, so a gate
// can act as any member without a request. The gate's own import stays real.
const STUB = new URL("./session-stub.mts", import.meta.url).href;

export async function resolve(specifier, context, next) {
  const resolved = await next(specifier, context);
  const fromApp = context.parentURL?.includes("/src/") ?? false;
  if (fromApp && resolved.url.endsWith("/src/server/session.ts")) {
    return { url: STUB, shortCircuit: true };
  }
  return resolved;
}
