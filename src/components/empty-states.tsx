import { Button } from "./ui";
import { Icon } from "./icons";
import { createIssueAction } from "@/app/admin/actions";

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-sheet border-hairline flex min-h-[360px] flex-col items-center justify-center rounded-ui border p-9 text-center">
      {children}
    </div>
  );
}

function EmptyIcon({ name }: { name: "doc" | "users" }) {
  return (
    <div className="bg-newsprint text-red flex h-[72px] w-[72px] items-center justify-center rounded-full">
      <Icon name={name} size={32} strokeWidth={1.5} />
    </div>
  );
}

export function EmptyIssues() {
  return (
    <EmptyCard>
      <EmptyIcon name="doc" />
      <h2 className="text-lead mt-5 font-display text-2xl">No issues yet</h2>
      <p className="text-grey mt-2.5 max-w-sm font-ui text-[15px] leading-relaxed">
        The first one is the hardest — we&apos;ll guide you, page by page. Start
        with a cover and a heading.
      </p>
      <form action={createIssueAction} className="mt-6">
        <Button type="submit" icon="plus">
          Create your first issue
        </Button>
      </form>
    </EmptyCard>
  );
}

export function EmptyMembers({
  onImport,
  onAdd,
}: {
  onImport?: () => void;
  onAdd?: () => void;
}) {
  return (
    <EmptyCard>
      <EmptyIcon name="users" />
      <h2 className="text-lead mt-5 font-display text-2xl">No members yet</h2>
      <p className="text-grey mt-2.5 max-w-sm font-ui text-[15px] leading-relaxed">
        Bring your club&apos;s list across as a CSV, or add the first few by
        hand. They&apos;ll get every new issue.
      </p>
      <div className="mt-6 flex gap-2.5">
        <Button icon="upload" onClick={onImport}>
          Import CSV
        </Button>
        <Button variant="secondary" onClick={onAdd}>
          Add by hand
        </Button>
      </div>
    </EmptyCard>
  );
}
