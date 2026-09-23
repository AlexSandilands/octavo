// Stand-in for src/server/session.ts under the discussion checks: the same
// gates, answered from a user the gate sets with `actAs`.
type StubUser = { id: string; email: string; isAdmin: boolean; name: null };
const state = globalThis as { __discussionUser?: StubUser | null };

export function actAs(user: StubUser | null) {
  state.__discussionUser = user;
}

export async function getUserFailClosed() {
  return state.__discussionUser ?? null;
}
export const getUser = getUserFailClosed;

export async function getAdminUser() {
  const user = await getUserFailClosed();
  return user?.isAdmin ? user : null;
}

export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("Admin session required");
  return user;
}

export async function requireMember() {
  const user = await getUserFailClosed();
  if (!user) throw new Error("Member session required");
  return user;
}

// The page gate as a server action uses it (#300): the stub never redirects.
export async function requireMemberOrRedirect() {
  return getUserFailClosed();
}
