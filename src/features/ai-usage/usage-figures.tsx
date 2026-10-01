import { formatLeft, formatMoney, formatSpend } from "./format";

export type UsageBudget = {
  allowance: number;
  granted: number;
  spent: number;
  remaining: number;
};

// The month's three headline figures (#314). "Allowance" is the standing
// allowance plus the month's top-ups, so the three always add up.
export function UsageFigures({
  budget,
  current,
}: {
  budget: UsageBudget;
  /** The calendar month now running — the past reads as "left unused". */
  current: boolean;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <Figure
        term={current ? "Used this month" : "Used"}
        value={formatSpend(budget.spent)}
      />
      <Figure
        term={current ? "Remaining" : "Left unused"}
        value={formatLeft(budget.remaining)}
      />
      <Figure
        term="Allowance"
        value={formatMoney(budget.allowance + budget.granted)}
        note={
          budget.granted > 0
            ? `including ${formatMoney(budget.granted)} topped up`
            : undefined
        }
      />
    </dl>
  );
}

function Figure({
  term,
  value,
  note,
}: {
  term: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="bg-card border-line rounded-[10px] border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
      <dt className="text-faint font-sans text-[13px] font-semibold">{term}</dt>
      <dd className="text-ink mt-1 font-serif text-3xl tabular-nums">
        {value}
      </dd>
      {note && (
        <dd className="text-muted mt-1 font-sans text-[13px]">{note}</dd>
      )}
    </div>
  );
}
