import { redirect } from "next/navigation";
import { getUser } from "@/server/session";

// Gate every /admin page (dashboard, editor, preview, members, sponsors).
// This controls what the response contains — but server actions are separately
// gated with requireAdmin(), because actions can be invoked directly by any
// client that knows the action id, bypassing page-level checks entirely.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser().catch(() => null); // fail closed
  if (!user) redirect("/signin");
  if (!user.isAdmin) redirect("/"); // members belong in the library
  return children;
}
