// Content for `npm run db:seed`: ten issues of a small NZ pétanque club's
// members' magazine, with a story that threads through them — Margaret the
// veteran, Daniel the newcomer she mentors, and the long saga of saving the
// far rink. Exercises every block type, all three heading levels, the text
// sizes, cover pages, and a range of image placements (full, wrapped, banners,
// with and without captions). Pure data; the runner (seed.ts) processes the
// images and inserts these.
import type {
  Block,
  HeadingLevel,
  IssueContent,
  Page,
  TextSize,
} from "../lib/blocks";

const id = () => crypto.randomUUID();

// Terse block builders so the issues below read like an outline.
const H = (title: string, kicker = "", level?: HeadingLevel): Block => ({
  id: id(),
  type: "heading",
  kicker,
  title,
  level,
});
const T = (text: string, size?: TextSize): Block => ({
  id: id(),
  type: "text",
  text,
  size,
});
const Img = (
  imageId: string,
  caption = "",
  align: "full" | "left" | "right" = "full",
  width = 100,
): Block => ({ id: id(), type: "image", imageId, caption, align, width });
const Spon = (name: string, href?: string): Block => ({
  id: id(),
  type: "sponsor",
  name,
  href,
});
const page = (blocks: Block[]): Page => ({ id: id(), blocks });
const cover = (blocks: Block[]): Page => ({ id: id(), cover: true, blocks });

export type SeedImages = {
  boules: string;
  measure: string;
  terrain: string;
  group: string;
  building: string;
};

// Which asset backs each logical image, and its key in SeedImages.
export const SEED_ASSETS: { key: keyof SeedImages; file: string }[] = [
  { key: "boules", file: "4.jpg" },
  { key: "measure", file: "1.jpg" },
  { key: "terrain", file: "2.webp" },
  { key: "group", file: "3.webp" },
  { key: "building", file: "5.jpg" },
];

export type SeedIssue = {
  number: number;
  title: string;
  theme: string;
  status: "published";
  publishedAt: Date;
  content: IssueContent;
};

export function buildIssues(img: SeedImages): SeedIssue[] {
  const issue = (
    number: number,
    title: string,
    theme: string,
    date: string,
    pages: Page[],
  ): SeedIssue => ({
    number,
    title,
    theme,
    status: "published",
    publishedAt: new Date(date),
    content: { pages },
  });

  return [
    // 1 ─ Autumn 2024 ─ the season opens, Margaret introduced ────────────────
    issue(1, "First Light", "classic", "2024-03-16", [
      cover([
        H("First Light", "Autumn 2024 · The Members' Magazine"),
        Img(img.boules, "", "full", 60),
        T("The season opens"),
        T("Autumn 2024"),
      ]),
      page([
        H("Opening the Season", "Editorial", "main"),
        T(
          "The gates came off the rink at dawn and, for the first time since autumn, the gravel was warm by noon. There is no ceremony for this — only the sound of the first boule finding its line.",
        ),
        T(
          "We are ninety-one members this year, four of them new, and one terrain that has seen better decades. What follows is the first of our seasons together, in print.",
        ),
        Img(img.terrain, "The home rink, swept and waiting."),
      ]),
      page([
        H("The Steadiest Hand in the Club", "Profile", "section"),
        T("Margaret has not missed an opening day in thirty-one years.", "l"),
        Img(
          img.measure,
          "Margaret measures, as she always does, twice.",
          "right",
          45,
        ),
        T(
          "She arrives early, walks the length of the terrain twice, and says nothing to anyone until the first end is played. Ask her why and she will tell you the ground talks more honestly before the crowd arrives.",
        ),
        T(
          "Her game is not flashy. She points where others shoot, and she has won more ends by patience than anyone here cares to admit.",
        ),
        Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      ]),
    ]),

    // 2 ─ Winter 2024 ─ the measure, close calls ─────────────────────────────
    issue(2, "The Measure", "classic", "2024-06-15", [
      cover([
        H("The Measure", "Winter 2024"),
        Img(img.measure, "", "full", 58),
        T("Eleven millimetres"),
        T("Winter 2024"),
      ]),
      page([
        H("The Winter Doubles", "Report", "main"),
        T(
          "By the second end it was clear the terrain would do most of the talking. The rain of the week before had left the far rink slow and honest; the near rink ran fast and full of opinions.",
        ),
        H("The Final End", "", "paragraph"),
        T(
          "In the end a single boule, eleven millimetres closer than its rival, decided the title. The measure took four minutes. Nobody breathed.",
        ),
        Img(img.measure),
      ]),
      page([
        H("Reading the Ground", "Technique", "section"),
        T(
          "New players think the game is in the hand. It is not — it is in the eye, and the eye is trained on the ground, not the target.",
          "l",
        ),
        Img(
          img.terrain,
          "The donnée: the spot a thrown boule should land.",
          "left",
          45,
        ),
        T(
          "Find the donnée, the place a boule should land to roll true, and the rest is arithmetic. Margaret can read a rink the way others read a clock.",
        ),
        T(
          "A note for newer hands: the jack — we call it the cochonnet, the little pig — must come to rest between six and ten metres. Anything else, throw again.",
          "s",
        ),
      ]),
    ]),

    // 3 ─ Spring 2024 ─ Daniel arrives; the far rink appeal begins ────────────
    issue(3, "New Hands", "modern", "2024-09-14", [
      cover([
        H("New Hands", "Spring 2024"),
        Img(img.terrain, "", "full", 66),
        T("A newcomer learns to point"),
        T("Spring 2024"),
      ]),
      page([
        H("The Newcomer", "Feature", "main"),
        T(
          "Daniel came to us in September knowing nothing, holding a borrowed boule like a man holding someone else's baby.",
          "l",
        ),
        Img(img.boules, "Borrowed boules, first morning.", "right", 42),
        T(
          "By the third week he could land a boule within a metre of the jack with something like intention. Margaret took him on, which surprised everyone, including Daniel.",
        ),
        H("What Margaret Teaches", "", "paragraph"),
        T(
          "“You are not throwing at the jack,” she told him. “You are throwing at a spot on the ground that you have not yet chosen. Choose it first.”",
        ),
        T(
          "He is, she says, the first newcomer in years to listen before arguing.",
        ),
      ]),
      page([
        H("Around the Club", "Notice", "section"),
        Img(
          img.group,
          "The club, photographed on a grey Saturday — most of us, anyway.",
        ),
        T(
          "The committee has voted to begin raising funds for the far rink, whose drainage has, in the captain's words, “given up entirely.” More on that, no doubt, for seasons to come.",
        ),
        Spon("Kawau Bay Hardware"),
      ]),
    ]),

    // 4 ─ Summer 2024 ─ the long lunch, the appeal, a passing ─────────────────
    issue(4, "The Long Table", "classic", "2024-12-14", [
      cover([
        H("The Long Table", "Summer 2024"),
        Img(img.group, "", "full", 78),
        T("The club at table"),
        T("Summer 2024"),
      ]),
      page([
        H("The Longest Lunch", "Club Life", "main"),
        T(
          "Every summer the trestle tables come out, end to end, the length of the clubhouse veranda, and the season pauses for a day.",
        ),
        Img(img.terrain, "", "left", 45),
        T(
          "There was a raffle (won, scandalously, by the captain), a speech that ran long, and a fund that grew by eight hundred dollars toward the far rink.",
        ),
        H("In Memoriam", "", "paragraph"),
        T(
          "We note, with sadness, the passing of Greg Johnson, who set up more newcomers with loaner boules than anyone can count. The near rink is his, as far as we are concerned.",
        ),
      ]),
      page([
        H("Saving the Far Rink", "Appeal", "section"),
        T(
          "The far rink has drained badly for three winters. It is time.",
          "xl",
        ),
        T(
          "We are raising six thousand dollars to lift, re-level and re-lay the surface before next winter. Every set of boules bought through Hawthorn & Reed this season sends five dollars to the fund.",
        ),
        Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      ]),
    ]),

    // 5 ─ Autumn 2025 ─ the dig ───────────────────────────────────────────────
    issue(5, "Drainage & Other Dramas", "modern", "2025-03-15", [
      cover([
        H("Drainage & Other Dramas", "Autumn 2025"),
        Img(img.terrain, "", "full", 64),
        T("Mud, money and machinery"),
        T("Autumn 2025"),
      ]),
      page([
        H("The Dig Begins", "Project", "main"),
        T(
          "In March the digger arrived, and the far rink — beloved, hopeless — became a rectangle of mud.",
          "l",
        ),
        Img(img.measure, "Measuring out the new levels.", "right", 45),
        T(
          "Twelve volunteers, three wheelbarrows and one borrowed laser level. By the end of the first weekend we had a hole; by the end of the second, a graded bed waiting for stone.",
        ),
        T(
          "Daniel, it turns out, drives a digger for a living. He has not stopped grinning.",
        ),
      ]),
      page([
        H("Notes from the Mud", "Diary", "section"),
        T(
          "Saturday: rain. Sunday: rain. The trench held. Margaret brought scones and supervised.",
          "m",
        ),
        Img(img.group),
        Spon("Coastline Earthworks"),
      ]),
    ]),

    // 6 ─ Winter 2025 ─ technique; Daniel's first tournament ──────────────────
    issue(6, "Carry the Weight", "classic", "2025-06-14", [
      cover([
        H("Carry the Weight", "Winter 2025"),
        Img(img.boules, "", "full", 60),
        T("On pointing and shooting"),
        T("Winter 2025"),
      ]),
      page([
        H("Point, Then Shoot", "Technique", "main"),
        T(
          "Every player is, at heart, either a pointer or a shooter. The great ones are both, and know which the moment requires.",
          "l",
        ),
        Img(
          img.measure,
          "Boule on boule — a carreau, if you're lucky.",
          "left",
          45,
        ),
        H("The Pointer", "", "paragraph"),
        T(
          "The pointer lays a boule close and lets the ground do the work. It is a patient art, and an undervalued one.",
        ),
        H("The Shooter", "", "paragraph"),
        T(
          "The shooter strikes an opponent's boule clean from its place. Done perfectly — a carreau — your boule stops dead where theirs sat. It is the most satisfying thing in the game.",
        ),
      ]),
      page([
        H("Daniel's First Draw", "Report", "section"),
        T(
          "He drew a regional semifinalist in the first round and lost, honourably, thirteen to nine.",
        ),
        Img(img.building, "Away courts, first tournament."),
        T(
          "“I wasn't nervous until I saw her measure,” he said afterwards. “She measured like she already knew.” Margaret, watching from the rail, said only: “He'll do.”",
        ),
        Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      ]),
    ]),

    // 7 ─ Spring 2025 ─ the new rink opens ────────────────────────────────────
    issue(7, "The New Rink", "modern", "2025-09-13", [
      cover([
        H("The New Rink", "Spring 2025"),
        Img(img.terrain, "", "full", 66),
        T("Open at last"),
        T("Spring 2025"),
      ]),
      page([
        H("Open at Last", "Project", "main"),
        T(
          "Six months, eleven tonnes of crushed stone and one very long winter later, the far rink is level, fast and true.",
          "l",
        ),
        Img(img.terrain, "The far rink, reborn."),
        T(
          "Margaret threw the first boule, as is right. It landed, of course, exactly where she meant it to.",
        ),
      ]),
      page([
        H("Thank You", "Acknowledgement", "section"),
        T(
          "To the twelve who dug, the four who fed them, and the businesses below who carried us — thank you.",
        ),
        Spon("Coastline Earthworks"),
        Spon("Hawthorn & Reed Outfitters", "https://example.com"),
        T(
          "The fund closed forty dollars over target. The forty dollars bought scones.",
          "s",
        ),
      ]),
    ]),

    // 8 ─ Summer 2025 ─ the Kawau Cup ─────────────────────────────────────────
    issue(8, "The Kawau Cup", "classic", "2025-12-13", [
      cover([
        H("The Kawau Cup", "Summer 2025"),
        Img(img.building, "", "full", 64),
        T("The club championship"),
        T("Summer 2025"),
      ]),
      page([
        H("The Cup Returns", "Championship", "main"),
        T(
          "The Kawau Cup, contested every summer since 1978, came down — as it so often does — to the last end, on the new far rink.",
        ),
        Img(
          img.building,
          "Finals day, under a sky that couldn't decide.",
          "right",
          45,
        ),
        H("The Final", "", "paragraph"),
        T(
          "Margaret and Daniel, paired by the draw, against the captain and his daughter. Twelve all. One boule each remaining.",
        ),
        T(
          "Daniel pointed; it sat a hand from the jack. The captain shot, and missed by the width of the cochonnet. Margaret did not even throw her last. She didn't need to.",
        ),
      ]),
      page([
        H("Honours", "Results", "section"),
        Img(
          img.group,
          "Champions, runners-up, and everyone who stayed for the photo.",
        ),
        T(
          "Winners: M. Ellery & D. Ross. Runners-up: T. Vane & C. Vane. Best newcomer: D. Ross.",
        ),
        T(
          "The full ladder is pinned in the clubhouse, where it will be argued over until autumn.",
          "s",
        ),
        Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      ]),
    ]),

    // 9 ─ Autumn 2026 ─ the away championship ─────────────────────────────────
    issue(9, "Travelling Boules", "modern", "2026-03-14", [
      cover([
        H("Travelling Boules", "Autumn 2026"),
        Img(img.group, "", "full", 78),
        T("On the road to the regionals"),
        T("Autumn 2026"),
      ]),
      page([
        H("On the Road", "Away", "main"),
        T(
          "Four cars, eleven players and a chilly bin of sandwiches left the clubhouse at six for the regional championship, three hours south.",
          "l",
        ),
        Img(
          img.building,
          "The regional grounds — grand, and colder than ours.",
        ),
        T(
          "We did not win. We finished fourth of nineteen, which for a club our size is something close to a triumph, and we said so, loudly, the whole way home.",
        ),
      ]),
      page([
        H("What We Learned", "Reflection", "section"),
        T(
          "That the bigger clubs are not braver, only better drilled. That Daniel can hold his nerve. That Margaret, at seventy-three, can still play six hours and drive the first leg home.",
        ),
        Img(img.measure, "", "left", 42),
        T(
          "“Next year,” said the captain, to nobody in particular, “we practise the tir.”",
        ),
        Spon("Kawau Bay Hardware"),
      ]),
    ]),

    // 10 ─ Winter 2026 ─ Margaret steps back; the handover ────────────────────
    issue(10, "The Steadiest Hand", "classic", "2026-06-20", [
      cover([
        H("The Steadiest Hand", "Winter 2026"),
        Img(img.measure, "", "full", 58),
        T("Thirty-two seasons"),
        T("Winter 2026"),
      ]),
      page([
        H("Thirty-Two Openings", "Tribute", "main"),
        T(
          "Margaret Ellery has decided this will be her last season as club captain. She is not, she is at pains to say, going anywhere else.",
          "l",
        ),
        Img(
          img.measure,
          "The hand that measured a thousand ends.",
          "right",
          45,
        ),
        T(
          "Thirty-two opening days. Four club championships. One terrain saved, largely because she refused to let us give up on it.",
        ),
        H("The Handover", "", "paragraph"),
        T(
          "She is handing on the measure — the actual, physical tape, worn soft at the reel — to Daniel Ross, who arrived three winters ago knowing nothing and now reads a rink almost as well as she does. Almost.",
        ),
      ]),
      page([
        H("The Long Game", "Editorial", "section"),
        T(
          "This magazine began two years ago as three stapled pages. You are reading our tenth.",
          "l",
        ),
        Img(img.terrain, "The home rink, on an ordinary, perfect morning."),
        T(
          "The far rink drains. The newcomers keep coming. The boules go out at dawn and come in at dusk, and somewhere in between, a point is measured to the millimetre and conceded by nobody.",
        ),
        T(
          "Margaret would tell you it is a simple game. She would be wrong, and she knows it. That is rather the point.",
        ),
        Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      ]),
    ]),
  ];
}
