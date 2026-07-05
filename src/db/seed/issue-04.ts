import {
  cover,
  H,
  Img,
  mkIssue,
  page,
  type SeedImages,
  Spon,
  T,
} from "./builders";

// No. 4 — Regatta. A sailing club's season review on the modern theme, and the
// longest issue in the seed: sustained long-form across nine content pages,
// wrapped images both sides, a wide banner, small-type results, and two
// sponsors. Shows an issue with real page count in the flipbook.
export const issue04 = (img: SeedImages) =>
  mkIssue(4, "Regatta — The Season Review", "modern", "2026-01-17", [
    cover([
      H("Regatta", "The Sailing Club Annual · Season Review"),
      Img(img.harbour, {
        alt: "An abstract seascape: a red sun over deep blue swells beneath a pale sky.",
        width: 70,
      }),
      T("Nine races, one dismasting, and a champion nobody picked"),
    ]),

    page([
      H("The Season, Considered", "Commodore's Letter", "main"),
      T(
        "There are years when the water teaches and years when it merely examines, and this was, by common consent, an examining year. We sailed nine of the scheduled ten races, abandoned one to a flat calm that arrived like a verdict, and finished the season with a champion whose name appeared on nobody's list in the spring — including, she insists, her own.",
        "l",
      ),
      T(
        "You will find the whole story in these pages: the races as they were sailed rather than as they were retold in the bar, the results in full, and a proper account of the Wednesday evening series, which continues to be the best thing this club does and the hardest to explain to anyone who has not stood on a committee boat at dusk wondering where the wind went.",
      ),
    ]),

    page([
      H("The Spring Series", "Part One", "section"),
      T(
        "The season opened the way seasons here traditionally open: with a forecast that promised twelve knots from the south-west and a morning that delivered four from everywhere at once. Race One was won by whoever guessed the shifts best, which is to say it was won by Ida Bergström, who does not guess. She read the tide line off the eastern shore, banked left when the fleet went right, and rounded the top mark with a lead she never gave back.",
      ),
      Img(img.pennants, {
        caption: "Race flags over the club deck — the full spring set.",
        alt: "A wide banner of triangular signal pennants in navy, rust and white rows.",
      }),
      T(
        "Races Two and Three belonged to the Hollis brothers, who sail an elderly boat immaculately and treat every start line like a personal insult. By the end of April the series table had the Hollises on top, Bergström two points adrift, and the defending champion — becalmed twice and over the line early once — composing what he later called a philosophical position on luck.",
      ),
    ]),

    page([
      H("A Wind With Opinions", "Part Two", "section"),
      Img(img.chart, {
        caption:
          "The committee's tide chart, annotated past legibility by June.",
        alt: "Fine concentric contour rings around a small red point on pale blue, like a nautical chart.",
        align: "left",
        width: 44,
      }),
      T(
        "Midwinter sailing is this club's sworn peculiarity, and the June and July races made the case for it. The water was the temperature of a legal dispute, the wind arrived with opinions, and the racing was the closest of the year. Race Five finished with three boats overlapped at the line and the finishing gun fired, after protest and appeal, in favour of Bergström by a margin the measurer described as 'the width of the paint.'",
      ),
      T(
        "Race Six is already legend and will only grow. The wind rose through the afternoon until the committee hoisted the shorten-course flag, and the fleet came home surfing, grinning, and in one case — the Hollis brothers, whose mast let go at the final gate with the race in hand — swimming. Both brothers were recovered promptly, in good order and mid-argument about whose trim was responsible. The mast has been retired to the clubhouse wall, where it is already collecting signatures.",
      ),
    ]),

    page([
      H("The Wednesday Evenings", "Part Three", "section"),
      T(
        "No trophies are awarded for the Wednesday series, which is precisely why half the club turns out for it. It is sailing reduced to its sociable essentials: a short course, a shared start, and the long golden hour home. Newcomers crew their first races on Wednesdays; the season's best rivalries were all incubated there; and the galley's soup, it must be recorded, improved out of all recognition after the March incident, of which no more will be written here.",
      ),
      T(
        "If you have been meaning to try the club, try a Wednesday. Bring a jumper. The soup is now genuinely good.",
        "l",
      ),
    ]),

    page([
      H("The Decider", "Part Four", "section"),
      T(
        "So it came down, as the whole bar had predicted by August, to the final race: Bergström and the repaired, re-masted, and audibly motivated Hollis brothers, level on points, first across the line to take the season. The morning offered a clean fourteen knots and no excuses.",
      ),
      T(
        "The Hollises won the start — they always win the start — and held the lead up the first beat with Bergström camped on their air. What followed was twenty minutes of the best match racing this club has seen: four lead changes, a port-starboard crossing that aged the race officer visibly, and a final run in which Bergström sailed six boat-lengths of extra distance to find a private band of pressure along the western shore that nobody else believed in.",
      ),
      T(
        "She crossed the line four seconds clear. The brothers, to their lasting credit, were the first aboard her boat with the bottle.",
      ),
    ]),

    page([
      H("Champion, Unranked", "Profile", "main"),
      T(
        "Ida Bergström joined three seasons ago with a boat older than the clubhouse carpet and a habit of finishing mid-fleet while looking at the water instead of the fleet. This, it turns out, was research.",
        "l",
      ),
      T(
        '"Everyone here knows how to sail," she said, when pressed for a champion\'s statement at the prizegiving. "I just spent two years learning where the wind lives. It has addresses. Most of them are written on the shore." She then thanked her crew, the galley, and "the tide, for being punctual," and sat down to the longest applause of the night.',
      ),
    ]),

    page([
      H("Results in Full", "The Record", "section"),
      T(
        "Final championship standings, nine races, one discard applied. Full race-by-race sheets are posted in the clubhouse and held by the sailing secretary.",
      ),
      T(
        "1. Bergström, 11 pts. 2. Hollis & Hollis, 13 pts. 3. Okonkwo, 21 pts. 4. Marsh, 24 pts. 5. Whitcombe, 29 pts. 6. Devlin, 30 pts. 7. Faulkner, 38 pts. 8. Reyes, 41 pts. 9. Chandra, 45 pts. 10. Byrne, 52 pts.",
        "s",
      ),
      T(
        "Wednesday series: no results are kept, by standing order of the membership, and the membership is right.",
        "s",
      ),
    ]),

    page([
      H("Flags & Thanks", "The Year Ahead", "section"),
      T(
        "The new season opens the first Saturday after the equinox, with the fitting-out weekend a fortnight before. The committee boat needs volunteers, the race box needs a new kettle, and the Hollis brothers, it is rumoured, need a new mast section — sponsors of that particular cause should apply directly to the bar.",
      ),
      Spon("Northgate Sailmakers", "https://example.com"),
      Spon("Harbour Chandlery & Rope Co."),
      T(
        "Regatta is published each January by the sailing club and distributed to all members, past commodores, and one framed copy to the harbourmaster, who claims not to read it.",
        "s",
      ),
    ]),
  ]);
