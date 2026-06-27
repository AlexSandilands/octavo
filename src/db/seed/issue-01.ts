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

// No. 1 — Autumn 2024. The first issue: the club introduces itself, the terrain,
// and Margaret. Sets up the far-rink trouble that runs through the year.
export const issue01 = (img: SeedImages) =>
  mkIssue(1, "First Light", "classic", "2024-03-16", [
    cover([
      H("First Light", "Autumn 2024 · The Members' Magazine"),
      Img(img.boules, "", "full", 60),
      T("The season opens — and, at last, in print"),
      T("Autumn 2024"),
    ]),

    page([
      H("Opening the Season", "Editorial", "main"),
      T(
        "The gates came off the rink at dawn and, for the first time since autumn, the gravel was warm by noon. There is no ceremony for this — no ribbon, no speeches, no committee member clearing their throat. There is only the sound of the first boule of the year finding its line down the terrain, and then a second answering it, and by ten o'clock the particular music of a club that has remembered, all at once, what it is for.",
      ),
      T(
        "We have been a club for forty-six years and a club in print for exactly none of them. That changes with the page you are holding. The committee resolved over winter that a club which measures a point to the millimetre ought to keep some record of itself, and so here we are: a magazine, stapled at first and now rather more than that, written by whoever will write and read by, we hope, all of you.",
      ),
      T(
        "There is a great deal to tell. We are ninety-one members this season, four of them entirely new to the game and one of them, remarkably, new to the country. We have a terrain that has given us forty years of good service and is beginning, politely but unmistakably, to ask for something back. And we have, as ever, Margaret — but more on her shortly, and at the length she deserves and will pretend to resent.",
      ),
      T(
        "For now: welcome. Sweep your boules, check the cochonnet for chips, and read on.",
        "l",
      ),
    ]),

    page([
      H("Ninety-One, and Counting", "The Club", "section"),
      Img(img.terrain, "The home rink on opening morning, swept and waiting."),
      T(
        "Ninety-one is the most members the club has carried since the early nineties, when a brief and now-forgotten television appearance sent a wave of curious locals our way. Most of those drifted off within a season; the few who stayed are, not coincidentally, among our best players today. There is a lesson in that which the committee repeats to itself whenever a newcomer looks lost: stay kind, stay patient, and the ground will do the recruiting for you.",
      ),
      T(
        "Of the four genuine beginners this year, two are retirees who have downsized into the bay and gone looking for something to do with their afternoons; one is a nurse on shift work who can only make the Tuesday twilight sessions; and one we have not yet properly met, who turned up at the gate in February, watched two full games without a word, and left before anyone could press a boule into his hand. We rather hope he comes back.",
      ),
    ]),

    page([
      H("The Steadiest Hand in the Club", "Profile", "main"),
      T(
        "Margaret Ellery has not missed an opening day in thirty-one years, and she will tell you, if you give her the smallest opening, that she does not intend to start now.",
        "l",
      ),
      Img(
        img.measure,
        "Margaret measures, as she always does, twice.",
        "right",
        42,
      ),
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
        "A new column, to run as long as anyone keeps reading it: the small mechanics of the game, set down plainly for those just starting and those who have quietly been doing it wrong for years. We begin, as one must, with the hand.",
      ),
      H("The Grip", "", "paragraph"),
      Img(img.boules, "Palm down, fingers together — the grip.", "left", 38),
      T(
        "Hold the boule with the palm facing down and the fingers together, not splayed. The thumb does almost nothing; resist the urge to give it a job. When you release, the back-spin imparted by that palm-down grip is what lets a boule check up and stop rather than run on forever — and a boule that stops where you meant it to is the entire game in a single sentence.",
      ),
      H("The Release", "", "paragraph"),
      Img(
        img.measure,
        "The release: low, level, and earlier than feels natural.",
        "right",
        38,
      ),
      T(
        "Release low and release early. The commonest beginner's fault is to hang on a fraction too long, lofting the boule so it lands flat and skids. Let it go while your hand is still rising and your knuckles are barely above your knee. It will feel wrong for about three hundred throws. Then, one Tuesday twilight, it will feel like the only sensible way a person could possibly let go of anything, and you will wonder how you ever did otherwise.",
      ),
    ]),

    page([
      H("Forty-Six Years on the Bay", "History", "section"),
      T(
        "The club was founded in 1978 by a knot of expatriate French engineers working on the harbour bridge upgrade, who arrived with their own boules and a low opinion of the local idea of a leisurely afternoon. They laid the first rink themselves, by hand, on a reclaimed corner of the domain that the council had earmarked for a car park and never got around to sealing. The car park has never been mentioned by the council since, and we are not about to remind them.",
      ),
      T(
        'The clubhouse came in 1983, the second rink in 1991, and the famous green umbrellas — without which no club photograph is now considered complete — in 2004, after a member returned from a tournament in the south and declared the shade situation "frankly amateur." The far rink, the one now giving us such trouble, was the engineers\' original, and there is a feeling about the place that we owe it rather more than a quiet retirement.',
      ),
    ]),

    page([
      H("Around the Club", "Notices", "section"),
      Img(
        img.group,
        "The whole club, more or less, on opening morning.",
        "full",
        100,
      ),
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
        "The autumn programme is mercifully simple. Club doubles begin the first Saturday of April and run fortnightly; the Winter Doubles — our oldest internal competition, and the one everyone secretly wants — falls in June, as always, on whichever weekend the weather looks least promising. The away fixture against the southern clubs is pencilled in for the spring, pending the usual negotiations over who drives.",
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
