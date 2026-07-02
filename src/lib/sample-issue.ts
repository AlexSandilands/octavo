// Static sample content so the scaffolded pages render with realistic copy.
// Replace with real data from the database as features are built.
import type { Status } from "@/components/ui";

export type IssueSummary = {
  id: number;
  no: number;
  title: string;
  date: string;
  status: Status;
  pages: number;
  sub: string;
};

export const issues: IssueSummary[] = [
  {
    id: 14,
    no: 14,
    title: "The Long Game",
    date: "Winter 2026",
    status: "Published",
    pages: 12,
    sub: "Emailed to 1,002 members · today",
  },
  {
    id: 15,
    no: 15,
    title: "Untitled draft",
    date: "Spring 2026",
    status: "Draft",
    pages: 5,
    sub: "Last edited 2 days ago",
  },
  {
    id: 13,
    no: 13,
    title: "The Far Rink",
    date: "Autumn 2026",
    status: "Published",
    pages: 11,
    sub: "Emailed to 987 members",
  },
  {
    id: 12,
    no: 12,
    title: "High Summer",
    date: "Summer 2025",
    status: "Published",
    pages: 10,
    sub: "Emailed to 951 members",
  },
];

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

export type Page = {
  n: number;
  kicker: string;
  heading?: string;
  standfirst?: string;
  body: string[];
  imgLabel?: string;
};

export const pages: Page[] = [
  {
    n: 1,
    kicker: "Editorial",
    heading: "A Note on Winter",
    body: [
      "There is a particular pleasure to a winter morning on the piste: the gravel firm underfoot, breath hanging in the air, and the slow ceremony of measuring a point that no one will concede.",
    ],
    imgLabel: "PHOTO · frost on the terrain, early",
  },
  {
    n: 2,
    kicker: "From the President",
    heading: "From the President",
    body: [
      "This issue marks our fourteenth, and our largest Winter Doubles yet — forty-one pairs across two days.",
      "Inside you will find the full results, a little hard-won technique from Margaret, the diary for the season ahead, and the usual notices from around the club.",
      "— Te Rōpū Henare, President",
    ],
  },
  {
    n: 3,
    kicker: "Report",
    heading: "The Winter Doubles",
    standfirst:
      "Forty-one pairs, two days of weather that could not make up its mind, and a final settled by eleven millimetres.",
    body: [
      "By the second end it was clear the terrain would do most of the talking. The rain of the week before had left the far rink slow and honest; the near rink, sheltered by the macrocarpa, ran fast and full of opinions.",
    ],
  },
  {
    n: 4,
    kicker: "Report",
    body: [
      "The Hutt pairing pointed beautifully all morning, conceding little and shooting less. But it was the veterans — Reweti and Lin, a combined age north of one hundred and forty — who found the line on the slow rink and would not give it back.",
      "In the end a single boule, eleven millimetres closer than its rival, decided the title. The measure took four minutes. Nobody breathed.",
    ],
    imgLabel: "PHOTO · the measure, final end",
  },
  {
    n: 5,
    kicker: "Results",
    heading: "Final Standings",
    body: [
      "1 — Reweti & Lin, Champions",
      "2 — Ngata & Sól",
      "3 — Brett & Anahera",
      "4 — Tau & Mere, Whangārei",
      "A full draw and every result is posted on the club board and online.",
    ],
  },
  {
    n: 6,
    kicker: "Technique",
    heading: "Reading the Ground",
    standfirst:
      "Margaret Cole on why the ground tells you far more than your arm ever will.",
    body: [
      "New players think pétanque is a game of the hand. It is not. It is a game of the eye, and the eye is trained on the ground, not the cochonnet.",
    ],
  },
  {
    n: 7,
    kicker: "Technique",
    body: [
      "Walk the line your boule must travel before you ever pick it up. Where is it fast? Where does the gravel gather and grab? A donnée — the spot where you land the boule — is chosen for the ground, never for the distance alone.",
      "Point to the terrain you can read. Leave the heroics for the days you cannot.",
    ],
    imgLabel: "DIAGRAM · the donnée and the roll",
  },
  {
    n: 8,
    kicker: "For Beginners",
    heading: "A Beginner's Cochonnet",
    standfirst: "Everything the new player needs, and nothing they do not.",
    body: [
      "The cochonnet — the little wooden target, also called the jack — is thrown first, between six and ten metres.",
      "To point is to roll your boule as close as you can. To shoot is to knock an opponent away. Most of the game, and nearly all of the pleasure, is in the pointing.",
    ],
  },
  {
    n: 9,
    kicker: "For Beginners",
    body: [
      "A team holds the cochonnet until the other team places a boule closer. The end is scored only when every boule is thrown: one point for each of yours nearer than the closest of theirs.",
      "Thirteen wins. To lose thirteen to nil is to be fannied — and tradition dictates what follows.",
    ],
    imgLabel: "ILLUSTRATION · pointing vs. shooting",
  },
  {
    n: 10,
    kicker: "Diary",
    heading: "Club Diary",
    body: [
      "JUL 06 — Club morning, all grades, 9.30am",
      "JUL 20 — Triples ladder, round one",
      "AUG 03 — Beginners' clinic with Margaret",
      "AUG 24 — Inter-club vs. Wellington",
      "SEP 14 — Spring Singles, entries close the 7th",
    ],
  },
  {
    n: 11,
    kicker: "Members",
    heading: "Members' Corner",
    body: [
      "A warm welcome to nine new members this quarter, and to the Saturday juniors, who now number fourteen.",
      "Get-well wishes to Hone, who promises to be back on the piste before the singles.",
    ],
  },
  {
    n: 12,
    kicker: "",
    body: [
      "This magazine is published quarterly for club members.",
      "Edited this issue by A. Cole. Photography by the membership. Printed on the wind.",
    ],
  },
];

export type TocItem = { label: string; page: number };

export const toc: TocItem[] = [
  { label: "A Note on Winter", page: 1 },
  { label: "From the President", page: 2 },
  { label: "The Winter Doubles", page: 3 },
  { label: "Final Standings", page: 5 },
  { label: "Reading the Ground", page: 6 },
  { label: "A Beginner's Cochonnet", page: 8 },
  { label: "Club Diary", page: 10 },
  { label: "Members' Corner", page: 11 },
];
