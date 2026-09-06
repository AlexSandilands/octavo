import { Icon } from "@/components/icons";
import { FigureBadge, FigureFrame } from "./guide-ui";

// A sketch of the Members screen (members-manager.tsx and friends), built from
// the site's tokens. Decorative (FigureFrame hides it from screen readers);
// the numbered legend in section-members.tsx carries the meaning.

function MockRow({
  initials,
  name,
  email,
  subscribed,
  admin,
  badges,
}: {
  initials: string;
  name: string;
  email: string;
  subscribed: boolean;
  admin: boolean;
  badges?: boolean;
}) {
  return (
    <div className="border-hairline flex items-center gap-2.5 border-b px-4 py-2.5 last:border-b-0">
      <span className="bg-primary-soft text-primary flex h-8 w-8 flex-none items-center justify-center rounded-full font-ui text-[10px] font-semibold">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-fg block truncate font-ui text-[12.5px] font-semibold">
          {name}
        </span>
        <span className="text-fg-muted block truncate font-ui text-[10.5px]">
          {email}
        </span>
      </span>
      <span className="flex w-[112px] flex-none items-center gap-1.5">
        {badges && <FigureBadge n={3} />}
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-1 font-ui text-[9.5px] font-semibold ${
            subscribed
              ? "bg-primary-soft text-primary"
              : "bg-surface-2 text-fg-muted"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${subscribed ? "bg-ok" : "bg-edge"}`}
          />
          {subscribed ? "Subscribed" : "Unsubscribed"}
        </span>
      </span>
      <span className="flex w-[96px] flex-none items-center gap-1.5">
        {badges && <FigureBadge n={4} />}
        <span className="text-fg-muted flex items-center gap-1 font-ui text-[11px] font-medium">
          <Icon name={admin ? "check" : "plus"} size={11} strokeWidth={2} />
          {admin ? "Admin" : "Make admin"}
        </span>
      </span>
      <span className="flex flex-none items-center gap-1.5">
        {badges && <FigureBadge n={5} />}
        <Icon name="close" size={15} className="text-fg-muted" />
      </span>
    </div>
  );
}

export function MembersFigure() {
  return (
    <FigureFrame caption="A sketch of the Members screen. The numbers match the list below.">
      <div className="scrollbar-soft overflow-x-auto [--scrollbar-surface:var(--color-card)]">
        <div className="border-hairline bg-surface min-w-[460px] overflow-hidden rounded-field border">
          <div className="border-hairline flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <span className="text-fg font-ui font-bold text-[16px]">
              Members
            </span>
            <div className="flex flex-none items-center gap-2">
              <FigureBadge n={2} />
              <span className="border-hairline text-fg flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1.5 font-ui text-[11.5px] font-semibold">
                <Icon name="upload" size={12} strokeWidth={2} />
                Import CSV
              </span>
              <FigureBadge n={1} />
              <span className="bg-primary text-surface flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-ui text-[11.5px] font-semibold">
                <Icon name="plus" size={12} strokeWidth={2} />
                Add member
              </span>
            </div>
          </div>
          <MockRow
            initials="MH"
            name="Margaret Holt"
            email="margaret@example.com"
            subscribed
            admin
            badges
          />
          <MockRow
            initials="JP"
            name="June Parata"
            email="june@example.com"
            subscribed={false}
            admin={false}
          />
        </div>
      </div>
    </FigureFrame>
  );
}
