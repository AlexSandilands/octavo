import { Button } from "./ui";
import { Icon, type IconName } from "./icons";
import { createIssueAction } from "@/app/admin/actions";

// The one empty state: a card with an icon in a tinted circle, a sentence and
// a pill CTA. Reused by the lists, the logo library and the sponsors page.
export function EmptyCard({
  icon,
  title,
  body,
  children,
  compact = false,
}: {
  icon: IconName;
  title: string;
  body: React.ReactNode;
  /** The call to action(s). */
  children?: React.ReactNode;
  /** A shorter card for an empty section inside another card. */
  compact?: boolean;
}) {
  return (
    <div
      className={`bg-surface border-hairline flex flex-col items-center justify-center rounded-card border text-center ${
        compact ? "p-6" : "shadow-card min-h-[340px] p-8"
      }`}
    >
      <div
        className={`bg-primary-soft text-primary flex items-center justify-center rounded-full ${
          compact ? "h-14 w-14" : "h-[72px] w-[72px]"
        }`}
      >
        <Icon name={icon} size={compact ? 26 : 32} strokeWidth={1.7} />
      </div>
      <h2
        className={`text-fg mt-4 font-ui font-bold ${compact ? "text-[19px]" : "text-[24px]"}`}
      >
        {title}
      </h2>
      <p className="text-fg-muted mt-2 max-w-sm font-ui text-[16px] leading-relaxed">
        {body}
      </p>
      {children && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function EmptyIssues() {
  return (
    <EmptyCard
      icon="doc"
      title="No issues yet"
      body="The first one is the hardest — we'll guide you, page by page. Start with a cover and a heading."
    >
      <form action={createIssueAction}>
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
    <EmptyCard
      icon="users"
      title="No members yet"
      body="Bring your club's list across as a CSV, or add the first few by hand. They'll get every new issue."
    >
      <Button icon="upload" onClick={onImport}>
        Import CSV
      </Button>
      <Button variant="secondary" icon="plus" onClick={onAdd}>
        Add by hand
      </Button>
    </EmptyCard>
  );
}
