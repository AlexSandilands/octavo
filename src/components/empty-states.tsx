import { Button } from "./ui";
import { createIssueAction } from "@/app/admin/actions";

// A first-run screen is a boxed notice: a rule, a headline, a sentence and the
// one or two things to do next — no illustration to decode.
export function EmptyNotice({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-lead bg-sheet rule-heavy flex min-h-[320px] flex-col items-center justify-center border p-8 text-center">
      <h2 className="text-lead font-display text-[30px] leading-tight font-semibold">
        {title}
      </h2>
      <p className="text-grey mt-3 max-w-md font-ui text-[17px] leading-relaxed">
        {children}
      </p>
      {actions && (
        <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div>
      )}
    </div>
  );
}

export function EmptyIssues() {
  return (
    <EmptyNotice
      title="No issues yet"
      actions={
        <form action={createIssueAction}>
          <Button type="submit" icon="plus">
            Create your first issue
          </Button>
        </form>
      }
    >
      The first one is the hardest — we&apos;ll guide you, page by page. Start
      with a cover and a heading.
    </EmptyNotice>
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
    <EmptyNotice
      title="No members yet"
      actions={
        <>
          <Button icon="upload" onClick={onImport}>
            Import CSV
          </Button>
          <Button variant="secondary" onClick={onAdd}>
            Add by hand
          </Button>
        </>
      }
    >
      Bring your club&apos;s list across as a CSV, or add the first few by
      hand. They&apos;ll get every new issue.
    </EmptyNotice>
  );
}
