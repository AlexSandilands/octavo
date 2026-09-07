import { Icon } from "@/components/icons";
import {
  FigureBadge,
  FigureFrame,
  MiniButton,
  MiniLink,
  MiniStatus,
} from "./guide-ui";

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
  zebra = false,
}: {
  initials: string;
  name: string;
  email: string;
  subscribed: boolean;
  admin: boolean;
  badges?: boolean;
  zebra?: boolean;
}) {
  return (
    <div
      className={`border-hairline flex items-center gap-2.5 border-b px-4 py-2.5 ${
        zebra ? "bg-newsprint" : ""
      }`}
    >
      <span className="border-lead text-lead flex h-8 w-8 flex-none items-center justify-center border font-ui text-[10px] font-bold">
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
        <MiniStatus>{subscribed ? "Subscribed" : "Unsubscribed"}</MiniStatus>
      </span>
      <span className="text-grey w-[60px] flex-none font-ui text-[11px]">
        {admin ? "Admin" : "Member"}
      </span>
      <span className="flex flex-none items-center gap-2">
        {badges && <FigureBadge n={4} />}
        <MiniLink>{admin ? "Remove admin" : "Make admin"}</MiniLink>
        <MiniLink>Edit</MiniLink>
        {badges && <FigureBadge n={5} />}
        <MiniLink>Remove</MiniLink>
      </span>
    </div>
  );
}

export function MembersFigure() {
  return (
    <FigureFrame caption="A sketch of the Members screen. The numbers match the list below.">
      <div className="scrollbar-soft overflow-x-auto">
        <div className="border-lead bg-sheet min-w-[540px] overflow-hidden border">
          <div className="border-lead flex items-center justify-between gap-2 border-b-[3px] px-4 py-2.5">
            <span className="text-lead font-display text-[18px] font-semibold">
              Members
            </span>
            <div className="flex flex-none items-center gap-2">
              <FigureBadge n={2} />
              <MiniButton>
                <Icon name="upload" size={12} strokeWidth={2} />
                Import CSV
              </MiniButton>
              <FigureBadge n={1} />
              <MiniButton primary>
                <Icon name="plus" size={12} strokeWidth={2} />
                Add member
              </MiniButton>
            </div>
          </div>
          <div className="border-hairline text-grey-soft flex items-center gap-2.5 border-b px-4 py-1.5 font-ui text-[8px] font-semibold tracking-[0.14em] uppercase">
            <span className="w-8 flex-none" />
            <span className="flex-1">Member</span>
            <span className="w-[112px] flex-none">Subscription</span>
            <span className="w-[60px] flex-none">Role</span>
            <span className="flex-none">Actions</span>
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
            zebra
          />
        </div>
      </div>
    </FigureFrame>
  );
}
