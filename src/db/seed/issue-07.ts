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

// No. 7 — Spring 2025. The new far rink opens; Margaret throws the first boule;
// the fund closes over target. The saga's payoff issue.
export const issue07 = (img: SeedImages) =>
  mkIssue(7, "The New Rink", "modern", "2025-09-13", [
    cover([
      H("The New Rink", "Spring 2025"),
      Img(img.terrain, "", "full", 66),
      T("Open at last, and true as a plumb line"),
      T("Spring 2025"),
    ]),

    page([
      H("What We Built", "Editorial", "main"),
      T(
        "Three years ago this rink was a lake. Two years ago it was an appeal. One year ago it was a hole, and four weekends of barrowed stone, and a borrowed laser level that has still not forgiven us. This spring, it is a rink again — level, fast, true, and entirely the work of this club's own hands and your own generosity. We have, in the most literal sense, rebuilt our own foundation, and it has changed the place in ways we are only beginning to feel.",
      ),
      T(
        "There is a temptation, in an editorial like this, to reach for the large word — community, legacy, that sort of thing — and we will try to resist it, because the club itself resisted it. There were no large words at the opening. There was a ribbon, a short speech, a boule thrown by the right person, and then, immediately and gratefully, a game. That is who we are. We mark our great occasions by getting on with the thing the occasion was for.",
      ),
      T(
        "Still. Look at what you built. It is allowed, just this once, to feel rather proud.",
        "l",
      ),
    ]),

    page([
      H("Open at Last", "Project", "main"),
      T(
        "Six months, fifteen tonnes of crushed stone, four volunteer weekends and one very long winter under the tarpaulins later, the new far rink was opened on the first Saturday of September before the largest gathering the club has assembled outside of a long lunch.",
        "l",
      ),
      Img(
        img.terrain,
        "The far rink, reborn — and, for once, photographed empty.",
        "right",
        45,
      ),
      T(
        'The ribbon — green, inevitably — was cut not by the president nor the captain but by the dig crew en masse, twelve pairs of scissors converging on a single length of tape in a scene of such comic disorganisation that the photograph of it has already been pinned in the clubhouse and captioned, by an unknown hand, "the only thing we did badly." Then the crowd parted, and Margaret walked out onto the surface she had supervised into being and lifted not one stone of, holding a single boule.',
      ),
      T(
        'She did not make a speech. She walked to the throwing circle, looked once down the length of the new rink — reading it, the way she has read every rink for forty years — chose her spot, and threw. The boule arched, dropped, bit the fresh surface, and rolled to a stop a hand\'s-breadth from the cochonnet, dead on the centre line. "Yes," she said, into a silence you could have heard a pin drop in. "That will play." And the whole club, more or less as one, lost its composure entirely.',
      ),
    ]),

    page([
      H("The First Game", "", "paragraph"),
      T(
        "The honour of the first competitive end on the new rink fell, by a draw that for once nobody accused of being rigged, to a four featuring both the club's philosophies in miniature: Margaret and Daniel, the pointers, against the captain and Amara Okafor, the shooters. It was, everyone agreed afterward, the perfect christening — a single end that ran to eight boules and three measures and contained, in its few minutes, the entire argument this club has been having with itself since 1978.",
      ),
      Img(
        img.measure,
        "The first measure on the new surface. It would not be the last.",
      ),
      T(
        "The end went, fittingly, to a measure — the new rink's surface so true that two boules finished a bare few millimetres apart where an older, lumpier terrain would have separated them by a foot. Margaret measured it herself, of course. The pointers took it. The captain demanded the tape be checked, of course. It was fine, of course. And then everyone played until the light went, on a rink that gave back exactly what it was given, which is all any of us ever really wanted from it.",
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "Daniel's Diary", "section"),
      T(
        "Spring. I played the first game on a rink I helped build, partnered by the woman who taught me to play, and I do not have the words for it, so I will just write down what happened. We won the first end. I pointed the boule that won it. The surface I had rolled flat with my own machine took my boule exactly the way I had hoped it would when I was rolling it, in the rain, eight months ago, wondering if any of it would work.",
      ),
      T(
        "Eighteen months ago I stood at that gate holding a stranger's boule, certain I would leave and never come back. I have now built part of this place and won the first point ever scored on it. I keep thinking about the man called Greg who handed me that first boule and told me everyone is hopeless at the start and it does not matter. He was right that it does not matter. He was wrong, I am happy to report, about the hopeless.",
      ),
      T(
        'Margaret said, after the game, "You\'ll have your own boules worn smooth before you know it." I think she meant it as a kindness about time passing. I have decided to take it as a prophecy.',
      ),
    ]),

    page([
      H("Thank You", "Acknowledgement", "main"),
      Img(
        img.group,
        "The people who made it: dig crew, cooks, donors, and the merely loud.",
      ),
      T(
        "It is not possible to thank everyone who saved the far rink, because the honest answer is that the whole club did, in one way or another — by barrowing, by baking, by donating, by buying their boules from the right shop, or simply by waiting out a winter of rink-rationing without quite coming to blows. But some debts must be named.",
      ),
      T(
        "To the twelve who dug, whose average age we have agreed to stop mentioning. To Joan and her field kitchen, which kept them upright. To Coastline Earthworks, who did the machine work at a rate we are still sworn to secrecy about. To our retired engineer, who drew it true. To Daniel, who built it. And to the anonymous donor — we will keep pretending we do not know — whose final, quiet cheque tipped the fund over the line. Thank you. All of you. The rink is yours.",
      ),
    ]),

    page([
      H("From the Terrain", "Technique", "section"),
      T(
        "A timely topic: how to play a new, fast surface, since the whole club is currently relearning the far rink from scratch and missing accordingly.",
        "l",
      ),
      Img(
        img.measure,
        "On a fast rink, the donnée moves well short of the jack.",
        "right",
        40,
      ),
      H("Throw Shorter", "", "paragraph"),
      T(
        "A fresh, true, well-drained surface is fast — it carries a boule further, for the same effort, than the old lumpy terrain ever did, and it punishes the habits a slow rink rewarded. The single biggest adjustment is the donnée: on a fast surface your chosen landing spot moves well short of where it used to be, because the boule will run so much further after it lands. Players who spent years learning to drop their boule near the jack are, this spring, watching it sail merrily past — and learning, gracefully or otherwise, to throw shorter.",
      ),
      T(
        '"Everyone\'s a beginner again," Margaret observed, with what looked suspiciously like enjoyment, watching the captain overthrow his fourth boule in a row. "It\'s the most honest the club\'s been in years." She is, of course, missing too — but rather less than the rest of us, on the entirely unfair grounds that she can read a new rink in an afternoon that takes everyone else a season.',
      ),
    ]),

    page([
      H("The Season Reopens", "The Club", "section"),
      T(
        "With both rinks now in play and in excellent order, the club enters its strongest spring in years. Membership stands at ninety-six, another record; the Tuesday twilights are so well attended that a second night is under discussion; and the standard of play, sharpened by the new surface and a crop of improving newcomers, is the highest the older members can remember.",
      ),
      T(
        "Attention now turns to the season's competitions and, beyond them, to a quiet ambition the committee has begun to voice aloud: that this club, for years a happy backwater, might at last be ready to send a serious pairing to the regional championship in the autumn. There are, suddenly, candidates. There is, suddenly, a rink worthy of training on. And there is, as ever, an argument about who gets to organise the trip.",
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        "Spring opens with the ladder reset and the new rink hosting its first full programme of club doubles. Early form suggests a wide-open season: Okafor and Ross have both started strongly, the Verralls are firing as ever, and the long Vane–Ellery duopoly at the summit looks, for the first time in years, genuinely under threat from below.",
      ),
      T(
        "First competitive end on the new far rink: M. Ellery & D. Ross def. T. Vane & A. Okafor, by measure. First demand that the tape be checked on the new far rink: T. Vane, immediately. First confirmation that the tape was fine: Margaret, wearily, eleven seconds later.",
      ),
      T(
        "Far-rink fund: closed, at $6,440 — forty dollars over the revised target. The committee has resolved, after lengthy debate, that the surplus forty dollars shall be spent on scones. It is, all agree, what the rink would have wanted.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "Every patron of this magazine gave to the far-rink fund, and one gave a great deal more than money. We thank them all, and below we thank the two without whom the rink would still be a lake — the one that moved the earth, and the one that kept the club in boules while we paid for it.",
      ),
      Spon("Coastline Earthworks"),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
    ]),
  ]);
