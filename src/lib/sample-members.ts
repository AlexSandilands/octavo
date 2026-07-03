// Static sample members so the admin members page renders with realistic
// rows. Replaced by real users-table CRUD in Phase 2 (issue #7).
import type { Status } from "@/components/ui";

export type Member = {
  name: string;
  email: string;
  status: Status;
  joined: string;
};

export const members: Member[] = [
  {
    name: "Margaret Cole",
    email: "margaret@example.com",
    status: "Subscribed",
    joined: "Mar 2019",
  },
  {
    name: "Te Rōpū Henare",
    email: "teropu@example.com",
    status: "Subscribed",
    joined: "Jan 2018",
  },
  {
    name: "Brett Siua",
    email: "brett@example.com",
    status: "Subscribed",
    joined: "Aug 2021",
  },
  {
    name: "Anahera Wells",
    email: "anahera@example.com",
    status: "Bounced",
    joined: "Feb 2024",
  },
  {
    name: "Lin Chen",
    email: "lin@example.com",
    status: "Subscribed",
    joined: "Jun 2017",
  },
  {
    name: "Hone Walker",
    email: "hone@example.com",
    status: "Unsubscribed",
    joined: "Nov 2022",
  },
  {
    name: "Sól Bjarnadóttir",
    email: "sol@example.com",
    status: "Subscribed",
    joined: "Sep 2023",
  },
];
