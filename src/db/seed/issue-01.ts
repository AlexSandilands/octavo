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

// No. 1 — The Boule & Bay Gazette. The archetypal small-club quarterly: classic
// theme, long-form prose, wrapped images, all three heading levels, a notices
// page and a patrons page. The warm, wry house voice the demo leads with.
export const issue01 = (img: SeedImages) =>
  mkIssue(1, "The Boule & Bay Gazette", "classic", "2025-04-12", [
    cover([
      H("The Boule & Bay Gazette", "Autumn 2025 · The Members' Quarterly"),
      Img(img.gravel, {
        alt: "Abstract landscape: an amber sun over layered green ridgelines.",
        width: 60,
      }),
      T("The season opens — and, at last, in print"),
      T("No. 1 · Autumn 2025"),
    ]),

    page([
      H("Opening the Season", "Editorial", "main"),
      T(
        "The gates came off the rink at dawn and, for the first time since autumn, the gravel was warm by noon. There is no ceremony for this — no ribbon, no speeches, no committee member clearing their throat. There is only the sound of the first boule of the year finding its line down the terrain, and then a second answering it, and by ten o'clock the particular music of a club that has remembered, all at once, what it is for.",
      ),
      T(
        "We have been a club for forty-six years and a club in print for exactly none of them. That changes with the page you are holding. The committee resolved over winter that a club which measures a point to the millimetre ought to keep some record of itself, and so here we are: a magazine, written by whoever will write and read by, we hope, all of you.",
      ),
      T(
        "For now: welcome. Sweep your boules, check the cochonnet for chips, and read on.",
        "l",
      ),
    ]),

    page([
      H("The Steadiest Hand in the Club", "Profile", "main"),
      T(
        "Margaret Ellery has not missed an opening day in thirty-one years, and she will tell you, if you give her the smallest opening, that she does not intend to start now.",
        "l",
      ),
      Img(img.dusk, {
        caption:
          "Last light over the far rink, where Margaret plays out the day.",
        alt: "Abstract landscape at dusk: a red sun low over dark ridgelines under a sand-coloured sky.",
        align: "right",
        width: 42,
      }),
      T(
        "She arrives before anyone, which is to say she arrives before the sun has properly cleared the macrocarpa at the eastern end. She walks the full length of the terrain twice — down one side, back the other — and she says nothing to anyone until the first end of the first game has been played out. Ask her why and she will tell you, with the patience of a woman who has answered the question for three decades, that the ground talks more honestly before the crowd arrives, and that it is only good manners to listen.",
      ),
      T(
        "Her game is not flashy and never has been. Where younger players reach for the spectacular — the shot that scatters an opponent's boule into the long grass — Margaret points. She lays her boule down close and lets the terrain carry it the last few inches, and she has won more ends by sheer accumulated patience than anyone in the club cares to admit out loud.",
      ),
    ]),

    page([
      H("On Patience", "", "paragraph"),
      T(
        '"People think the point is to be close," she says, rolling a boule absently from hand to hand as she talks. "The point is to be closer than him. Those are very different games. The first one you can lose by being unlucky. The second one you mostly lose by being impatient." She has, by her own reckoning, been impatient perhaps four times in thirty-one years, and lost each time, and remembers each of them with a clarity that suggests the losses still rankle.',
      ),
      H("On Newcomers", "", "paragraph"),
      T(
        'She is, despite a reputation for flintiness, the club\'s most generous teacher — though only of those who will listen before they argue. "You can\'t teach somebody who already knows," she says. "And most of them already know. They\'ve watched it on the television and they think it\'s bowls with a French accent. It is not bowls. Bowls forgives you. This does not." Then she softens, fractionally. "But when one of them goes quiet and starts watching the ground instead of the jack — that one you can teach. That one\'s worth the whole season."',
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
    ]),

    page([
      H("From the Terrain", "Technique", "main"),
      T(
        "A new column, to run as long as anyone keeps reading it: the small mechanics of the game, set down plainly for those just starting and those who have quietly been doing it wrong for years. We begin, as one must, with the ground itself.",
      ),
      H("Reading the Terrain", "", "paragraph"),
      Img(img.terrain, {
        caption:
          "Every terrain has a grain. Find it before your opponent does.",
        alt: "Concentric contour rings around an amber point, like a survey map of the rink.",
        align: "left",
        width: 38,
      }),
      T(
        "No two metres of a gravel rink behave alike. There is a firm line down the middle of ours that everyone knows about, and a soft, treacherous seam by the southern board that only the patient have mapped. Before your first end, walk the ground. Roll a boule gently down your intended line and watch what it does — not roughly where it goes, but exactly where it breaks. The terrain will tell you everything if you ask it before the game starts, and nothing but lies afterwards.",
      ),
      H("The Release", "", "paragraph"),
      T(
        "Release low and release early. The commonest beginner's fault is to hang on a fraction too long, lofting the boule so it lands flat and skids. Let it go while your hand is still rising and your knuckles are barely above your knee. It will feel wrong for about three hundred throws. Then, one Tuesday twilight, it will feel like the only sensible way a person could possibly let go of anything, and you will wonder how you ever did otherwise.",
      ),
    ]),

    page([
      H("Around the Club", "Notices", "section"),
      T(
        "Tuesday twilight sessions resume from the 19th, lights permitting, and will run until the clocks change. Beginners are not merely welcome at these but actively wanted; they are the gentlest way into the game, and nobody keeps score who does not ask to.",
      ),
      T(
        'The committee is seeking a volunteer to take over the keeping of the ladder, a role that involves a clipboard, a pencil, and a thick skin. The outgoing keeper wishes it known that he is retiring "entirely voluntarily" and "with no hard feelings whatsoever," which fools nobody.',
      ),
      T(
        "Lost property now includes three left gloves, a thermos, and a single boule of unknown ownership that has sat in the clubhouse since November. It is a good boule. Someone is missing it. Claim it before the captain decides it is his.",
        "s",
      ),
    ]),

    page([
      H("Fixtures & the Ladder", "The Season Ahead", "section"),
      T(
        "The autumn programme is mercifully simple. Club doubles begin the first Saturday of next month and run fortnightly; the Winter Doubles — our oldest internal competition, and the one everyone secretly wants — falls in June, as always, on whichever weekend the weather looks least promising.",
      ),
      T(
        "The ladder resets today, as it does every opening day, which means that for one glorious morning every member of the club is, officially, equal first. Margaret has already pointed out that this will not survive contact with the afternoon. She is, as usual, correct.",
      ),
      T(
        "A full fixture card is pinned in the clubhouse and will be reproduced, space allowing, in these pages as the season unfolds.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "This magazine, and a good deal else besides, is possible only because a handful of local businesses decided a small pétanque club was worth backing. We mean to repay them in the only currency we have: your custom, and our genuine thanks.",
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      Spon("Kawau Bay Hardware"),
      T(
        "If you would like to see your business on this page, the rates are modest and the readership is loyal, if elderly. Speak to anyone on the committee, or simply to anyone holding a clipboard.",
        "s",
      ),
    ]),
  ]);
