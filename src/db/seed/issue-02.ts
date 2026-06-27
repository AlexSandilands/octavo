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

// No. 2 — Winter 2024. The Winter Doubles, decided by eleven millimetres; a deep
// dive on the measure itself; the captain, Tomas Vane, introduced.
export const issue02 = (img: SeedImages) =>
  mkIssue(2, "The Measure", "classic", "2024-06-15", [
    cover([
      H("The Measure", "Winter 2024"),
      Img(img.measure, "", "full", 58),
      T("A title decided by eleven millimetres"),
      T("Winter 2024"),
    ]),

    page([
      H("The Cruelest Rink", "Editorial", "main"),
      T(
        "Winter is the honest season. The crowds thin to the committed; the casual summer player, who turns up for the sunshine and the sausage sizzle, is nowhere to be seen between June and August, and good riddance to them until spring. What remains is the hard core — the ones who will stand in a southerly with their collars up, blowing on their fingers between ends, because the alternative is not standing on the terrain, and that is not really an alternative at all.",
      ),
      T(
        "The cold changes the game, too, and not gently. A wet terrain runs slow and true and rewards the patient pointer; a frosted one, thawing unevenly through the morning, is a liar that tells a different story on every end. We have, this winter, a great deal of both, and the Winter Doubles — reported overleaf at the length its drama demands — was played out across the whole treacherous range of it.",
      ),
      T(
        "Read on. Then go and stand in the cold. You will play worse and enjoy it more.",
        "l",
      ),
    ]),

    page([
      H("The Winter Doubles", "Report", "main"),
      T(
        "Twenty-two pairs entered, which is two short of the record and four more than the committee had catered sandwiches for, a miscalculation that will be remembered longer than the result. By the second end of the first round it was clear the terrain would do most of the talking. The rain of the week before had left the far rink slow and honest; the near rink, oddly, ran fast and full of opinions, and pairs drew lots not knowing they were really drawing for two entirely different games.",
      ),
      Img(
        img.terrain,
        "Round one, far rink: slow, wet, and merciless on the over-eager.",
        "right",
        45,
      ),
      T(
        "The morning belonged to the pointers. On a terrain that slow, a shot that missed was a catastrophe — the shooter's boule running fifteen feet into nowhere while the careful pointer sat pretty by the jack — and the bold pairs went out in twos and threes through the early rounds, undone less by their opponents than by their own ambition. By lunch (such as it was, the sandwiches having been rationed) the four pairs left standing were, to nobody's surprise, the four most patient in the club.",
      ),
    ]),

    page([
      H("The Final End", "", "paragraph"),
      T(
        "The final was Margaret and her long-time partner Joan against the Verrall brothers, and it ran to thirteen-all with the light already going. The last end held six boules within a metre of the cochonnet, a tangle so dense that three separate members of the gallery offered three separate opinions on who was actually holding, and all three were wrong. There was nothing for it but the tape.",
      ),
      Img(img.measure, "The deciding measure: four minutes, nobody breathing."),
      T(
        "The measure took four minutes. Margaret did it herself, as the senior player, kneeling on a folded sack with the tape drawn taut between her boule and the Verralls' and the whole club leaning in over her shoulders. Eleven millimetres. Eleven. She read it out flatly, the way she reads everything out, and then she stood up, brushed the grit from her knees, and shook four hands. The Verralls took it like the gentlemen they are. Joan cried, a little, and denied it.",
      ),
    ]),

    page([
      H("Anatomy of a Measure", "Feature", "section"),
      T(
        "For a game so relaxed in temperament, pétanque settles its arguments with surprising precision. When two boules are close enough that the eye cannot separate them — and the eye, we promise you, is a worse judge than you think — the rules are clear: you measure, and the measurement is final, and you do not sulk.",
        "l",
      ),
      Img(
        img.measure,
        "A rigid measure for short gaps; a tape for longer.",
        "left",
        40,
      ),
      T(
        "For short distances the purists use a rigid measure, a set of feeler gauges not unlike a mechanic's, slid into the gap until one fits and the other does not. For anything longer the tape comes out, anchored at the cochonnet and drawn to the nearest edge of each boule in turn. The cardinal rule, broken by every beginner exactly once, is that you measure to the boule's nearest point, not its centre, and you do not — you do not — nudge anything while you do it.",
      ),
      T(
        "A measure of eleven millimetres, for the record, is not even particularly close by the standards of a serious final. The club record, set in 1997 and disputed annually, stands at a single millimetre, and the two men involved have not spoken a civil word to each other since.",
        "s",
      ),
    ]),

    page([
      H("From the Terrain", "Technique", "main"),
      T(
        "Last issue, the hand. This issue, the harder thing: the ground. New players think the game is in the hand. It is not — it is in the eye, and the eye must be trained on the terrain, not the target.",
        "l",
      ),
      Img(
        img.terrain,
        "The donnée — the chosen landing spot, well short of the jack.",
        "right",
        42,
      ),
      T(
        "Every good throw begins with a decision you make before you move: where, exactly, do you want the boule to first touch the ground? This spot — the donnée — is almost never the jack itself. On a fast terrain it might be two metres short, letting the boule roll the rest; on a slow, wet one it might be barely short at all. Choose it, fix your eye on it, and throw to it. Throw to the jack and you are gambling. Throw to a donnée and you are playing.",
      ),
      H("Reading It the Slow Way", "", "paragraph"),
      T(
        "Margaret can read a rink the way other people read a clock — a glance, and she knows the hour. The rest of us must do it the slow way: walk it, crouch to it, roll a spare boule down it and watch where it checks. There is no shortcut, and the players who pretend there is are the ones you most enjoy beating.",
      ),
    ]),

    page([
      H("The Captain's Chair", "Profile", "section"),
      Img(
        img.building,
        "Tomas Vane, who would like it known the club is not just for measuring.",
        "left",
        40,
      ),
      T(
        "Tomas Vane has been club captain for three years and a thorn in Margaret's side for considerably longer, which is, he insists, the proper relationship between a captain and a club's best player. Where Margaret points, Vane shoots — joyfully, recklessly, and often brilliantly — and the long-running and entirely friendly argument between their two philosophies is, as much as the terrain itself, the engine room of the club.",
      ),
      T(
        "\"Margaret will tell you the game is patience,\" he says, with the air of a man who has heard it once too often. \"And she's right, and it's also deathly dull to watch and worse to be. Sometimes you have to take the shot. Sometimes you have to break the whole thing open and see what falls out. That's not impatience. That's nerve.\" He pauses. \"She'd say there's a difference. There isn't.\" Asked to comment, Margaret declined, which everyone agreed was answer enough.",
      ),
    ]),

    page([
      H("Cold Comforts", "Club Life", "section"),
      T(
        "The clubhouse fire was lit for the first time this season on the last Saturday of May, and the change it works on the place is hard to overstate. A pétanque club in summer is a thing of the open air; a pétanque club in winter is a small warm room with the rain on the windows, a pot of something on the hob, and a dozen people who have run out of things to say about the game and started, at last, to talk about themselves.",
      ),
      T(
        'Joan has taken over the soup, which is an improvement on every previous arrangement, and the honesty box for the same now turns a small and welcome profit. The committee notes, without naming names, that the profit would be larger still if certain members treated "a gold coin" as a minimum rather than a target.',
      ),
      Img(img.group, "The hard core, between ends, in no hurry to go home."),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        "Winter Doubles — Winners: M. Ellery & J. Pratt (13–11). Runners-up: P. & D. Verrall. Plate (for first-round losers, who deserve something): the Tuesday Twilight pair of A. Okafor and her father, in their first competition.",
      ),
      T(
        'The ladder, three rounds into the club doubles, is led by Vane on count-back from Ellery, a state of affairs the captain has described as "the natural order" and Margaret has described as "June." There are fourteen weeks to go.',
      ),
      T(
        "Full results and the current ladder are pinned in the clubhouse, beside the fire, where they are read more often than the rules and believed rather less.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "The tape measure used to decide the Winter Doubles — and a good few finals before it — was donated, years ago, by the outfitter below, who understands better than most that this is a game of small margins and good kit.",
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      Spon("Verrall's Pharmacy"),
      T(
        "Yes, those Verralls. They took the final loss in good spirit and renewed their advertisement the same week, which tells you everything about why we like them.",
        "s",
      ),
    ]),
  ]);
