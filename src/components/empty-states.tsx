import { Button } from "./ui";
import { Icon } from "./icons";

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border-line flex min-h-[360px] flex-col items-center justify-center rounded-md border p-9 text-center shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
      {children}
    </div>
  );
}

function EmptyIcon({ name }: { name: "doc" | "users" }) {
  return (
    <div className="bg-tint text-accent flex h-[72px] w-[72px] items-center justify-center rounded-full">
      <Icon name={name} size={32} strokeWidth={1.5} />
    </div>
  );
}

export function EmptyIssues() {
  return (
    <EmptyCard>
      <EmptyIcon name="doc" />
      <h2 className="text-ink mt-5 font-serif text-2xl">No issues yet</h2>
      <p className="text-muted mt-2.5 max-w-sm font-sans text-[15px] leading-relaxed">
        The first one is the hardest — we&apos;ll guide you, page by page. Start
        with a cover and a heading.
      </p>
      <div className="mt-6">
        <Button icon="plus">Create your first issue</Button>
      </div>
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
      <h2 className="text-ink mt-5 font-serif text-2xl">No members yet</h2>
      <p className="text-muted mt-2.5 max-w-sm font-sans text-[15px] leading-relaxed">
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
