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
      <span className="bg-newsprint text-red flex h-8 w-8 flex-none items-center justify-center rounded-full font-ui text-[10px] font-semibold">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-lead block truncate font-ui text-[12.5px] font-semibold">
          {name}
        </span>
        <span className="text-grey-soft block truncate font-ui text-[10.5px]">
          {email}
        </span>
      </span>
      <span className="flex w-[112px] flex-none items-center gap-1.5">
        {badges && <FigureBadge n={3} />}
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-1 font-ui text-[9.5px] font-semibold ${
            subscribed ? "bg-newsprint text-red" : "bg-newsprint text-grey-soft"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${subscribed ? "bg-lead" : "bg-hairline-strong"}`}
          />
          {subscribed ? "Subscribed" : "Unsubscribed"}
        </span>
      </span>
      <span className="flex w-[96px] flex-none items-center gap-1.5">
        {badges && <FigureBadge n={4} />}
        <span className="text-grey flex items-center gap-1 font-ui text-[11px] font-medium">
          <Icon name={admin ? "check" : "plus"} size={11} strokeWidth={2} />
          {admin ? "Admin" : "Make admin"}
        </span>
      </span>
      <span className="flex flex-none items-center gap-1.5">
        {badges && <FigureBadge n={5} />}
        <Icon name="close" size={15} className="text-grey-soft" />
      </span>
    </div>
  );
}

export function MembersFigure() {
  return (
    <FigureFrame caption="A sketch of the Members screen. The numbers match the list below.">
      <div className="scrollbar-soft overflow-x-auto [--scrollbar-surface:var(--color-sheet)]">
        <div className="border-hairline bg-sheet min-w-[460px] overflow-hidden rounded-ui border">
          <div className="border-hairline flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <span className="text-lead font-display text-[16px]">Members</span>
            <div className="flex flex-none items-center gap-2">
              <FigureBadge n={2} />
              <span className="border-hairline text-lead flex items-center gap-1.5 rounded-ui border bg-white px-2.5 py-1.5 font-ui text-[11.5px] font-semibold">
                <Icon name="upload" size={12} strokeWidth={2} />
                Import CSV
              </span>
              <FigureBadge n={1} />
              <span className="bg-red text-sheet flex items-center gap-1.5 rounded-ui px-2.5 py-1.5 font-ui text-[11.5px] font-semibold">
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
