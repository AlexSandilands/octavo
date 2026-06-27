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

// No. 3 — Spring 2024. Daniel Ross arrives; Margaret takes him on; his first-
// person "Newcomer's Notebook" column begins; the far-rink appeal opens.
export const issue03 = (img: SeedImages) =>
  mkIssue(3, "New Hands", "modern", "2024-09-14", [
    cover([
      H("New Hands", "Spring 2024"),
      Img(img.terrain, "", "full", 66),
      T("A stranger at the gate learns to point"),
      T("Spring 2024"),
    ]),

    page([
      H("Things That Arrive in Spring", "Editorial", "main"),
      T(
        "Spring brings the club back to noisy life. The casual players return with the warmth, the Tuesday twilights swell, and the terrain — dry now, and fast — forgives a great deal that winter would have punished. It is the season of beginnings, and this spring has brought us a particularly good one: a newcomer who, against every recent precedent, has stuck.",
      ),
      T(
        "It has also brought us a problem we can no longer talk around. The far rink — the engineers' original, the heart of the place — has drained so badly through three successive winters that it spent most of July as a shallow lake. The committee has stopped pretending this is weather and started calling it what it is: the end of a surface's natural life. There is an appeal in these pages. Please read it, and please give what you can.",
      ),
      T(
        "Beginnings and endings, then, in the one issue. The game has always been good at holding both at once.",
        "l",
      ),
    ]),

    page([
      H("The Newcomer", "Feature", "main"),
      T(
        "Daniel Ross came to us in February, knowing nothing, and stood at the gate for two whole games holding a borrowed boule like a man holding someone else's baby — carefully, and as though he expected at any moment to be told he was doing it wrong.",
        "l",
      ),
      Img(
        img.boules,
        "Borrowed boules, first morning. He has his own now.",
        "right",
        42,
      ),
      T(
        "We had, frankly, written him off. Strangers turn up at the gate two or three times a season, watch a while, and melt away before anyone can teach them the difference between pointing and shooting, and we had Daniel down as one of these. He left that first day without a word. But he came back the next Saturday, and the one after that, and by the third week he could land a boule within a metre of the jack with something that was beginning to look like intention rather than luck.",
      ),
      T(
        "What changed everything was that Margaret took him on. She has not taken on a beginner in some years — she is, she will tell you, too old and too short of patience — and the club watched with frank astonishment as she walked the length of the far rink with this large, silent young man, pointing at the ground and waiting for him to nod.",
      ),
    ]),

    page([
      H("Why Him", "", "paragraph"),
      T(
        'Asked, later, what she had seen, Margaret was characteristically brief. "He watches the ground," she said. "Most of them watch the jack, or worse, they watch themselves. He went quiet and he watched the ground. You can teach that one." It is, from Margaret, something close to a coronation, and Daniel — who by his own account did not at first realise he was being singled out — has the slightly stunned air of a man who came for a hobby and has accidentally acquired a vocation.',
      ),
      H("What She Teaches", "", "paragraph"),
      T(
        '"You are not throwing at the jack," she told him, on that first long walk, and he has repeated it to us since with the reverence of scripture. "You are throwing at a spot on the ground that you have not yet chosen. So choose it first. Choose it, then throw to it, and stop looking at the little pig — the little pig is not going anywhere." He is, she says, the first newcomer in years to listen before he argues. "The rest of them," she adds, with a glance toward the captain, "never did learn that part."',
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "A New Column", "section"),
      T(
        'We have asked Daniel to keep a diary of his first season — the view from the very bottom of the ladder, for the encouragement of anyone else standing nervously at the gate. He has agreed, on condition that we print it "warts and all." Here, then, is the first instalment.',
      ),
      T(
        'Week one. I have never felt so large or so clumsy in my life. Everyone here is over sixty and moves like they have all the time in the world, and I, who am thirty-four and supposedly fit, threw eleven boules into the long grass before one stayed on the rink. An old woman I now know to be Margaret watched the whole thing without expression and then said, "Again, but slower," which I have since learned is the most useful sentence in the language.',
      ),
      T(
        "Week three. Today I put a boule within a hand's-width of the jack and the small huddle of regulars actually applauded, and I am not ashamed to say it has carried me through the entire week. I drive a digger for a living. Nobody has applauded me for anything in eleven years. I think I may have found my people.",
      ),
    ]),

    page([
      H("From the Terrain", "Technique", "main"),
      T(
        "This issue: the point itself — the patient, undervalued art of laying a boule close and leaving it there. The shooters get the glory and the photographs; the pointers get the ends, the matches, and very often the last laugh.",
        "l",
      ),
      Img(
        img.measure,
        "A high, soft point drops and dies; a flat one skids on.",
        "left",
        40,
      ),
      T(
        "The pointer's boule should arrive the way a cat lands: high, soft, and going almost straight down by the end. That trajectory — the demi-portée, the half-lob — is what lets it bite into the terrain and stop, rather than skidding through the cluster and out the far side. It is thrown with the same palm-down grip we covered in autumn, but lofted gently, so that gravity rather than momentum does the last of the work.",
      ),
      Img(img.boules, "", "right", 35),
      T(
        "Practise it alone, with no opponent and no jack — just a chalk circle on the terrain and a bucket of boules — until you can drop three of six inside it. Then move the circle. Then make it smaller. Margaret claims she did nothing else for the whole of her first winter, and that everything she has won since was bought, end by end, in that empty circle.",
      ),
    ]),

    page([
      H("Save the Far Rink", "Appeal", "main"),
      Img(
        img.group,
        "The club, on the day the appeal was announced — most of us, anyway.",
      ),
      T(
        "The committee has voted, unanimously and with heavy hearts, to launch an appeal to save the far rink. After three winters of failed drainage and one summer of standing water, the verdict of the two members who actually know about such things — one a retired civil engineer, the other Daniel, who digs for a living — is the same: the surface cannot be patched again. It must be lifted, re-levelled, and re-laid from the base up.",
      ),
      T(
        "The estimate is six thousand dollars. It is, for a club our size, a frightening number, and also exactly the kind of number a club our size has met before and will meet again. The fund opens today. Every set of boules bought through Hawthorn & Reed this season sends five dollars to it; the soup honesty box is doubling as a collection tin; and there will be, the committee promises with a certain grim cheer, a quiz night.",
      ),
    ]),

    page([
      H("Tuesday, Under Lights", "Club Life", "section"),
      Img(img.terrain, "", "right", 40),
      T(
        "The Tuesday twilight sessions have become, almost by accident, the warm heart of the club. They began as a concession to shift workers and the time-poor and have grown into the place newcomers are gentlest with themselves — no ladder, no count-back, no stakes higher than the next cup of tea. It is where Daniel found his feet, and where Amara Okafor, the nurse, has quietly become one of the best young shooters we have.",
      ),
      T(
        'There is something about the failing light and the strung-up bulbs that loosens everyone. People who would never dream of asking for help on a competition Saturday will, on a Tuesday, hand their boule to a stranger and say, "Show me what I\'m doing wrong." If you have been meaning to come and have not yet dared, come on a Tuesday. Come this Tuesday.',
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        "Spring club doubles — the season ended, after fourteen rounds, with Vane and Ellery dead level on points and Vane taking it on the finest of count-backs, a result he has had printed on a card and carries in his wallet. Margaret's only comment was to note that the season starts again in a fortnight.",
      ),
      T(
        'New members this quarter: D. Ross, and two returners we are delighted to see back. Total membership now stands at ninety-three, a club record, which the committee modestly attributes to "the magazine" and everyone else attributes to the weather.',
      ),
      T(
        "The far-rink fund stands, after one week, at $740 — of which $400 came from a single anonymous donor the committee strongly suspects of being Margaret.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "Both our patrons below have pledged to the far-rink appeal as well as to these pages, for which the club is more grateful than a column of small print can properly say.",
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      Spon("Kawau Bay Hardware"),
      T(
        "To donate to the appeal directly, see any committee member, drop a note in the soup tin, or — best of all — buy your spring kit from the outfitter above and let them do the rest.",
        "s",
      ),
    ]),
  ]);
