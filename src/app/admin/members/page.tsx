import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui";
import { EmptyMembers } from "@/components/empty-states";
import { MembersTable } from "@/features/members/members-table";
import { members } from "@/lib/sample-issue";

export default function MembersPage() {
  const count = (s: string) => members.filter((m) => m.status === s).length;
  const summary = `${count("Subscribed")} subscribed · ${count(
    "Unsubscribed",
  )} unsubscribed · ${count("Bounced")} bounced`;

  return (
    <AdminShell active="members">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-ink font-serif text-3xl">Members</h1>
          <p className="text-faint mt-1.5 font-sans text-sm">{summary}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon="upload">
            Import CSV
          </Button>
          <Button icon="plus">Add member</Button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="mt-8">
          <EmptyMembers />
        </div>
      ) : (
        <MembersTable members={members} />
      )}
    </AdminShell>
  );
}
