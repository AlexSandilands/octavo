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

// No. 6 — Winter 2025. A double issue on point vs shoot; Daniel plays his first
// away tournament and loses honourably; the new rink waits under tarpaulins.
export const issue06 = (img: SeedImages) =>
  mkIssue(6, "Carry the Weight", "classic", "2025-06-14", [
    cover([
      H("Carry the Weight", "Winter 2025"),
      Img(img.boules, "", "full", 60),
      T("On pointing, shooting, and knowing which"),
      T("Winter 2025"),
    ]),

    page([
      H("Two Ways to Win", "Editorial", "main"),
      T(
        "There is an argument that runs under every game of pétanque ever played, and it is the same argument that has run, good-naturedly and without resolution, through this club for forty-six years: is the game won by patience or by nerve? By the pointer, who lays a boule close and trusts the ground, or by the shooter, who removes the problem entirely with one flat, fearless throw? It is, of course, a false choice — the great players are both — but it is a false choice we never tire of arguing, and this winter issue gives it the full hearing it deserves.",
      ),
      T(
        "We do so partly because winter is the season for technical talk — there is little else to do but stand by the fire and disagree about the game — and partly because our own apprentice, Daniel, has just played his first away tournament, and came home with the one lesson no amount of practice on the home rink can teach: that under real pressure, against a real stranger, you find out which kind of player you actually are.",
      ),
      T("Pull up a chair by the fire. This one runs long.", "l"),
    ]),

    page([
      H("Point, Then Shoot", "Technique", "main"),
      T(
        "Every player is, at heart, either a pointer or a shooter — and the single most important tactical skill in the game is not mastery of either, but the judgement to know, in any given moment, which the end requires.",
        "l",
      ),
      Img(
        img.measure,
        "The shooter's reward: a clean carreau, boule for boule.",
        "right",
        42,
      ),
      T(
        'The principle is simple to state and a lifetime to master. When you are behind in an end and your opponent is holding several points, you generally shoot — you must break up the cluster, because pointing your way back into a crowded head is a slow road that rarely arrives. When you are ahead, or the head is open, you generally point — you build, boule by careful boule, and you make the other side do the breaking. The art is in the word "generally," which contains every hard decision the game will ever ask of you.',
      ),
      T(
        "Margaret, the club's great pointer, puts it this way: \"A shot is a question you ask the terrain when you've run out of patience. Sometimes that's the right time to ask it. Mostly it isn't.\" The captain, the club's great shooter, puts it differently: \"Pointing is what you do while you're working up the nerve to shoot.\" They have been having this exact conversation for fifteen years and neither has moved an inch.",
      ),
    ]),

    page([
      H("The Pointer", "", "paragraph"),
      T(
        "The pointer's game is one of accumulation. You lay a boule close; your opponent lays one closer; you lay one closer still, or beside it as a guard, or behind the jack to catch it if it moves. Nothing is spectacular and everything counts. The pointer wins by making the end too crowded and too finely balanced for a shooter to risk disturbing, and then by being, at the very last, eleven millimetres better. It is a patient, undervalued, and quietly ruthless way to play, and it has won this club more titles than every shot ever fired on it.",
      ),
      H("The Shooter", "", "paragraph"),
      T(
        "The shooter's game is one of demolition. Where the pointer adds, the shooter subtracts: one well-struck boule can undo three ends of patient building in a single second, scattering an opponent's careful head to the four winds and leaving your own boule, if the gods and the carreau are kind, sitting exactly where the trouble used to be. It is high-risk and high-reward and, when it comes off, the most purely thrilling thing in the game. When it does not, it is a boule in the long grass and a point handed meekly to a smirking pointer.",
      ),
    ]),

    page([
      H("Daniel's First Draw", "Report", "main"),
      T(
        "In May, for the first time, we sent Daniel away — to a small invitational at a neighbouring club, in a scratch doubles paired with Amara Okafor, the two of them representing the club's bright new future and, by their own joint admission, terrified out of their wits.",
        "l",
      ),
      Img(
        img.building,
        "Away courts: bigger, colder, and full of strangers who measure for fun.",
        "left",
        45,
      ),
      T(
        "They drew, in the first round, a pair containing a regional semifinalist, which is the kind of luck the draw reserves for newcomers it wishes to test. And they lost — thirteen to nine — but they lost in a way that turned several local heads, taking the semifinalist's pair to eleven ends and winning four of them outright, with Amara landing two carreaux of a quality that had the gallery murmuring and Daniel pointing with a steadiness that, under that pressure, frankly astonished everyone who knew how new he was.",
      ),
      T(
        '"I wasn\'t nervous until I saw her measure," Daniel said afterwards, of the semifinalist. "She measured like she already knew the answer. She measured like Margaret." Margaret, told of this on their return, watched Daniel cross the terrain for a long moment and then said only, to nobody in particular, "He\'ll do." From Margaret, as the whole club now understands, there is no higher grade.',
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "Daniel's Diary", "section"),
      T(
        "Winter. I have played in my first real tournament, against people I had never met, on a rink I had never seen, and I have learned the thing everyone here kept hinting at and none of them would just tell me: that the game you play in your head on a quiet Tuesday and the game your hands play when a stranger is winning are two completely different games, and the whole point of all the practice is to make them, slowly, into one.",
      ),
      T(
        'I missed two shots I would make nine times in ten at home. But I also pointed, on the last end, with the match nearly gone, a boule that I will remember when I have forgotten my own telephone number — high and soft and short, down a slope I had spent the whole match reading, and it bit and stopped a hand from the jack and I heard, behind me, a complete stranger say, quietly, "Oh, that\'s a player." I have driven a digger for eleven years and built half the roads in this district and I have never once been called a player. I think I would dig every hole in the country to hear it again.',
      ),
      T(
        'Amara was extraordinary and I told her so and she said, "You held your nerve, which is rarer." We have decided to enter the regionals together next year. We have not told the captain, who thinks the regionals are his to organise. This will be a problem for spring.',
      ),
    ]),

    page([
      H("The Brothers Verrall", "Profile", "section"),
      Img(img.measure, "", "right", 38),
      T(
        "No account of shooting at this club is complete without the Verralls, Peter and David, who have been firing boules at each other and everyone else for the better part of fifty years and who took it upon themselves, last winter, to teach Daniel the dark art over the strenuous objections of his official tutor. They run the pharmacy on the main road, finish each other's sentences, and disagree, violently and continuously, about every single aspect of the game except the supremacy of the shot.",
      ),
      T(
        '"Margaret\'s a wonderful player," says Peter, in the tone of a man about to say something unkind. "For a librarian," finishes David, who has never knowingly let a sentence of his brother\'s land without a kicker. They lost the Winter Doubles final to her last year by eleven millimetres and have, by their own cheerful account, replayed it roughly four thousand times since, winning on every occasion. "The tape," says Peter, "was wet." "The tape," agrees David, "was a disgrace." The tape, for the record, was fine.',
      ),
    ]),

    page([
      H("A Rink Under Wraps", "Club Life", "section"),
      Img(
        img.terrain,
        "The new far rink, tarped against the winter, curing slowly.",
        "left",
        42,
      ),
      T(
        "The new far rink spent this winter under tarpaulins, off-limits and curing, while the rest of the club crowded onto Johnson's rink and the near courts in a congestion not seen since the great television summer of the nineties. Tempers, in the queue for a rink, occasionally frayed; the committee notes that a club which has just spent six thousand dollars and four weekends building a new rink it is not yet allowed to use is a club in a peculiar and trying state of mind.",
      ),
      T(
        "But the wait is nearly over. The contractor has pronounced the surface ready to take play from early spring, and the committee is planning an opening worthy of three years of trouble and one of work: a ribbon, a speech kept mercifully short, and — by unanimous and unsurprising vote — the first boule to be thrown by Margaret, who supervised every weekend of the rebuild and lifted, to the end, not one single stone.",
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      Img(
        img.group,
        "The club, crowded onto Johnson's rink while the far one cured.",
        "full",
        100,
      ),
      T(
        'Winter Doubles — Winners: P. & D. Verrall, at last and at length, who celebrated their first title in four years by immediately demanding the tape be checked. Runners-up: A. Okafor & T. Vane, an unlikely captain-and-apprentice pairing that worked rather better than either expected. M. Ellery, seeking a third straight final, went out in the semis to her own protégé\'s partner, a result she described as "educational."',
      ),
      T(
        "The ladder, at the winter break, has Vane and Ellery level once more, with Okafor — remarkably, in only her second full season of competition — up to fourth and rising. The committee notes that the top of the club's ladder is, for the first time in a decade, not entirely grey-haired.",
      ),
      T(
        "New far rink: cured, tarped, and approximately one ribbon away from open. Days until spring, by the clubhouse calendar's increasingly impatient count: not many.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "Two of this issue's patrons are, between them, responsible for a great deal of the club's recent shooting — one having sponsored the kit, the other having taught the technique to half the membership from behind a pharmacy counter. We thank them for both, and for these pages.",
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      Spon("Verrall's Pharmacy"),
    ]),
  ]);
