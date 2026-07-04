import {
  cover,
  H,
  Img,
  mkIssue,
  page,
  type SeedImages,
  Spon,
  T,
  Thtml,
  Traw,
} from "./builders";

// No. 10 — Winter 2026. Margaret steps down as captain after thirty-two seasons
// and hands the measure to Daniel. The magazine's tenth issue; the arc closes.
export const issue10 = (img: SeedImages) =>
  mkIssue(10, "The Steadiest Hand", "classic", "2026-06-20", [
    cover([
      H("The Steadiest Hand", "Winter 2026"),
      Img(img.measure, "", "full", 58),
      T("Thirty-two seasons, and the passing of the tape"),
      T("Winter 2026"),
    ]),

    page([
      H("The Long Game", "Editorial", "main"),
      T(
        "This magazine began two years ago as three stapled pages, written at a kitchen table on the theory that a club which measures a point to the millimetre ought to keep some record of itself. You are holding our tenth issue. In the time between the first and this one, the club has gained a record membership, lost a beloved member, dug up and rebuilt its oldest rink, won and lost a regional semi-final, and watched a silent stranger at the gate become its champion. We have, it turns out, had rather a lot to record.",
      ),
      T(
        "This issue records the hardest and the most fitting of it: Margaret Ellery, after thirty-two opening days and three years as captain, is stepping back — not away, she insists, never away, but back — and handing the things a captain hands on. One of those things is a small, worn, physical object that means more to this club than any cup, and the passing of it is, we think, the truest story we have ever printed. We have given it the whole issue it deserves.",
      ),
      T(
        "It is, as Margaret would say, a simple game. She would be wrong, and she knows it, and that is rather the point.",
        "l",
      ),
    ]),

    page([
      H("Thirty-Two Openings", "Tribute", "main"),
      T(
        "Margaret Ellery has decided that this will be her last season as club captain. She is not, she is at very great pains to insist, going anywhere else — she will be at the gate next opening day, before the sun clears the macrocarpa, as she has been for thirty-two years — but she is laying down the clipboard, the committee headaches, and the quiet authority that has steadied this club for longer than a third of its members have been alive.",
        "l",
      ),
      Img(
        img.measure,
        "The hand that measured a thousand ends, and conceded almost none.",
        "right",
        42,
      ),
      T(
        "The numbers alone are a kind of monument. Thirty-two consecutive opening days, not one missed. Four Kawau Cups, across three decades, the most recent of them this past summer at the age of seventy-three. One terrain saved, largely because she refused, flatly and immovably, to let the club give up on it when giving up would have been easier and cheaper and quietly heartbreaking. And a coaching record — though she would never call it that — that runs from half the senior members of the club down to its newest champion.",
      ),
      T(
        "But the numbers miss the thing itself, which is harder to count: that for thirty-two years, this club has had, at its centre, one person who arrived early, read the ground honestly, told the truth about a measure even when the truth cost her the match, and treated the game and the people who play it with exactly the same patient, unsentimental, bone-deep respect. You cannot put that on a ladder. You can only miss it when it stops, and we are not, mercifully, going to have to.",
      ),
    ]),

    page([
      H("The Handover", "", "paragraph"),
      T(
        "There is, in this club, no formal ceremony for the changing of a captain — Margaret would have refused one on principle, and probably on grounds of expense. But there is a tradition, older than anyone can quite source, that an outgoing captain hands their successor some small token of the office, and Margaret has chosen hers with the care she brings to everything.",
      ),
      H("The Measure", "", "paragraph"),
      T(
        "She is handing on the measure — the actual, physical tape, a battered steel reel worn soft at the casing by thirty years of her own thumb, the same tape that read out eleven millimetres in the Winter Doubles and a single millimetre in the great disputed final of 1997. She is handing it to Daniel Ross, who arrived three winters ago at the gate knowing nothing, holding a stranger's boule like someone else's baby, and who now reads a rink almost — \"almost,\" she is careful to say, and means it — as well as she does.",
      ),
      T(
        '"A captain holds the measure," she told him, pressing the worn reel into his hand on a cold Tuesday twilight with most of the club pretending not to watch. "Not because the captain is the best player. Because the captain is the one everyone trusts to read it true, even when it goes against them. That\'s the whole job. The rest is just clipboards. You\'ll be fine at the clipboards. You\'re already good at the true part."',
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "Daniel's Diary", "section"),
      T(
        "Winter. The final entry, I think, in a diary I started two and a half years ago at the very bottom of the ladder, because I am not sure I count as a newcomer any more. This week Margaret Ellery handed me her measure — the actual tape, the one she has read every important point of my life with — and told the club I am to be the next captain. I have read that sentence back four times and I still do not entirely believe it is about me.",
      ),
      T(
        "I have been thinking about Greg, who handed me my first boule in my first week and told me everyone is hopeless at the start and it does not matter. I wish I could tell him where the spare boule led. From a stranger at the gate to the man holding the measure, in less than three years, because a dying club's worth of patient people kept setting me up, end after end, the way Greg set everyone up — never expecting anything back, just handing you the thing and trusting you to read it true.",
      ),
      T(
        "Margaret told me the rest I will have to learn from losing, and that she cannot help me with that. I think she is wrong, for once. I think she has been teaching me how to lose well this entire time — telling the truth about the measure when it goes against you is just losing well, made into a habit. I will hold the measure the way she held it. It is the only way I know how. Thank you, Margaret. Thank you, Greg. Thank you, all of you. I will see you at the gate before the sun is up.",
      ),
    ]),

    page([
      H("What Comes Next", "The Club", "section"),
      Img(
        img.terrain,
        "The home rink, on an ordinary, perfect midwinter morning.",
        "left",
        45,
      ),
      T(
        "A club does not stop when its steadiest hand steps back; if anything, this one has rarely looked stronger. Membership stands at ninety-eight. The far rink, two winters on from the lake, sheds the rain exactly as designed. Amara Okafor is a national prospect, Clara Vane a regional one, and the structured Tuesday shooting practice — born of a half-asleep captain's vow on a dark motorway home — has already, the older members grumble approvingly, raised the standard of the whole club.",
      ),
      T(
        "And there are, as ever, new hands at the gate. Three genuine beginners signed on over autumn, one of them a teenager who turns up alone on the bus, watches without a word, and leaves before anyone can press a boule into her hand. The older members watch her with a particular tenderness. They have seen this exact stranger before. They know, now, where the patience leads.",
      ),
    ]),

    page([
      H("The Whole Club, in Two People", "Reflection", "section"),
      Img(
        img.group,
        "The whole club, in one room — the long argument, at last on the same side.",
        "full",
        100,
      ),
      T(
        "Somebody asked Margaret, at the small and entirely unsanctioned gathering the club threw to mark her stepping back, what she was proudest of across thirty-two seasons. People expected the Cups, or the rink, or the long unbroken run of opening days. She thought about it for a while, in the way she thinks about a difficult measure, and then she nodded toward the far side of the room, where Daniel and Amara were locked in some fierce, laughing argument about whether his pointing or her shooting had really won them the regionals.",
      ),
      T(
        '"Those two," she said. "He builds it patiently and she breaks it open, and between them they are better than either, and better than I ever was. The whole argument this club\'s been having for forty-six years, finally standing in one corner of a room, on the same side, winning. I didn\'t do that. The club did that. But I got to watch it happen, and I got to hold the tape while it did." Then she put down her tea, because somebody had started a game on the new rink, and a club\'s last captain, like its first newcomer, is helpless before the sound of a boule finding its line.',
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        'Winter Doubles — Margaret\'s last as captain, and she went out exactly as she would have wished: in the final, on the new far rink, beaten by eleven millimetres. Winners: A. Okafor & D. Ross, the regional pair, at last together at home. Runners-up: M. Ellery & J. Pratt. "Eleven millimetres," Margaret noted, reading her own losing measure aloud without a flicker. "There\'s a tidiness to it." It was, by common agreement, the most Margaret sentence ever recorded in these pages.',
      ),
      T(
        'The winter ladder stands with Daniel Ross on top, Amara Okafor second, and Margaret — playing, by her own account, "entirely for the enjoyment now" — a contented fourth. The captaincy passes to Ross at the season\'s end. The measure, as reported, has already passed. The clipboards, Margaret notes, can wait until the very last possible moment.',
      ),
      T(
        "Losing margin in Margaret's final as captain: 11mm. Losing margin in the Winter Doubles that first put her name in this magazine, two years ago: also 11mm. The committee has checked. It is, against all odds, true.",
        "s",
      ),
    ]),

    page([
      H("The Long Game, Continued", "Editorial", "section"),
      T(
        "Two years and ten issues ago, we began this magazine not knowing whether anyone would read it. You did. You read about a tired terrain and helped us save it; you read about a stranger at the gate and watched him become a champion; you read, this issue, about the passing of a worn steel tape from one steady hand to another, and we hope it moved you a fraction as much as it moved us to set it down.",
      ),
      T(
        "We will keep writing it. The far rink drains, the newcomers keep coming, the boules go out at dawn and come in at dusk, and somewhere in between, on every single playing day, a point is measured to the millimetre and conceded, in the end, by nobody. That is the simple game Margaret says it is. It is also, as she well knows, every difficult and human thing a small club can be. We will see you next season, at the gate, before the sun is up.",
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
    ]),

    // Deliberately legacy-shaped content (issue #36): this one page authors its
    // body text in the pre-v3 stored shapes — Traw() a plain string (v1), Thtml()
    // a constrained-HTML string (v2) — so a freshly seeded database keeps
    // exercising the permanent string→doc render fallback and the migration
    // script's converter, even though every other T() block is now authored as a
    // v3 doc. These render identically to a v3 block; only the stored shape differs.
    page([
      H("From the Archive", "Corrections & Notes", "section"),
      Traw(
        "A note for the record, set in the old plain-text style the first issues used: the disputed 1997 final, long cited in these pages at a single millimetre, was in fact measured twice that night, and both readings agreed. The tape has never lied. Neither, for what it is worth, has Margaret.",
      ),
      Thtml(
        "<p>And a note in the <em>marked-up</em> style of our middle years: our thanks to the readers who wrote in with <strong>corrections</strong>, additions and the occasional firm disagreement. A magazine, like a measure, is <u>better for being checked</u>. Keep them coming — care of anyone at the gate holding a clipboard.</p>",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "Ten issues. Every one of them carried, in part, by the local businesses below and the few like them who decided a small bay pétanque club was worth backing. We have tried to repay them in custom and in genuine thanks, and we ask you, our readers, to keep doing the same. A club is its members; it is also, quietly, the handful of neighbours who keep the lights on.",
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      Spon("Coastline Earthworks"),
      Spon("The Cochonnet Café"),
      T(
        "And to Margaret, who is not going anywhere: thank you for thirty-two openings, and for the thirty-third, which we will all be at, watching you read the ground before the crowd arrives. Some things do not get handed on.",
        "s",
      ),
    ]),
  ]);
