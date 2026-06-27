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

// No. 8 — Summer 2025. The Kawau Cup, the club championship, won by Margaret and
// Daniel — the teacher and her apprentice — on the new far rink.
export const issue08 = (img: SeedImages) =>
  mkIssue(8, "The Kawau Cup", "classic", "2025-12-13", [
    cover([
      H("The Kawau Cup", "Summer 2025"),
      Img(img.building, "", "full", 64),
      T("The club championship, on the rink we built"),
      T("Summer 2025"),
    ]),

    page([
      H("The Cup, the Rink, the Story", "Editorial", "main"),
      T(
        "Some summers a club is handed a story so neat it would be rejected as implausible in a novel, and this was one of them. The Kawau Cup — our oldest and most coveted internal title, contested every summer since 1978 — was this year played for the first time on the new far rink, the one we spent three years saving and one rebuilding. And it was won by the pairing of the club's oldest great player and its newest good one: Margaret Ellery and Daniel Ross, the teacher and her apprentice, drawn together by a fate nobody dares call rigged because Margaret was in the room when the names came out of the hat.",
      ),
      T(
        "We are aware that this reads like sentiment. We can only report that we were there, and that it happened exactly as told, and that several hardened members of long standing were seen to be suspiciously bright about the eyes when the final measure was read. The far rink, it seems, was not the only thing this club rebuilt these last three years. Read on for the full account, which we have given the room it earned.",
      ),
      T("It came down, as the best ones do, to the very last end.", "l"),
    ]),

    page([
      H("The Cup Returns", "Championship", "main"),
      T(
        "The Kawau Cup is a doubles knockout, drawn from a hat, played over a single long summer's day, and it is the one title every member secretly wants above all others — partly for its history, partly because the trophy itself, a battered silver cup of frankly hideous design, has been argued over for forty-seven years and is beloved out of all proportion to its beauty.",
        "l",
      ),
      Img(
        img.building,
        "Finals day, under a sky that could not make up its mind.",
        "right",
        45,
      ),
      T(
        'Twenty pairs entered. The draw, as ever, was cruel and capricious: it put the Verralls out in the second round to a pair of Tuesday twilighters who had never won a competitive game between them, a result the brothers are still describing as "a freak of the new surface" and everyone else is describing as "funny." It sent the captain and his daughter Clara serenely through the top half. And it threw together, in the bottom half, the unlikely and now-famous pairing of Margaret and Daniel — drawn, the records will forever show, entirely at random.',
      ),
      T(
        'They were not, on paper, favourites. Margaret at seventy-three no longer plays a full day without tiring; Daniel, for all his promise, had a single away tournament to his name. But a pointer and a pointer, on a slow-playing afternoon, on a true new rink that rewarded patience — it was, the captain admitted afterwards, "the worst possible draw for the rest of us, and I should have seen it coming."',
      ),
    ]),

    page([
      H("The Final", "", "paragraph"),
      T(
        "The final was Margaret and Daniel against the captain and Clara Vane — pointers against shooters, age against youth, the teacher against the man who has beaten her more than anyone alive. It ran, of course, to thirteen-all. Of course it did. The whole day had been bending toward it from the first end, and when the score reached twelve apiece the crowd around the far rink had grown three deep and gone completely silent.",
      ),
      Img(
        img.measure,
        "The last end: one boule each, and the title between them.",
      ),
      T(
        'The last end came down to a single boule each. Daniel pointed first — a high, soft, short demi-portée down the slope he had read all day — and it dropped and bit and sat a hand from the jack, holding. The captain, needing to shoot it out, took his time, threw flat and fast and fearless, and missed by the width of the green cochonnet. And Margaret, with the title on her own last boule, looked at the head, looked at Daniel, and did not throw at all. She did not need to. She simply turned to the gallery and said, "Measure if you like." Nobody did.',
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "Daniel's Diary", "section"),
      T(
        "Summer. I have won the Kawau Cup, partnered by Margaret Ellery, on the rink I helped build, and I am writing this down quickly before I wake up. Two years ago I could not land a boule on the rink. Today I pointed the boule that held the final end of the club championship, and the woman who taught me everything declined to throw her last boule because mine had made hers unnecessary, which she later told me is the only compliment she has ever paid anyone that she actually meant.",
      ),
      T(
        "Here is the part I want to remember. When it was done — when the captain's shot had missed and the cup was ours — Margaret did not celebrate. She walked over, shook the captain's hand, shook Clara's, and only then turned to me and said, very quietly, so the gallery could not hear: \"Now you know you can do it when it counts. That's the last thing I had to teach you. The rest you'll have to learn from losing, and I can't help you with that.\" Then she went and got a cup of tea. I stood on the rink I built holding a hideous silver cup and I have never been happier in my life.",
      ),
      T(
        'Amara, knocked out in the semis, was the first to reach me. "Regionals," she said. "You and me. Autumn. No arguments." There were no arguments.',
      ),
    ]),

    page([
      H("The Vanes", "Profile", "section"),
      Img(img.building, "", "left", 40),
      T(
        "It would be easy, in an issue this devoted to the winners, to forget the pair they beat — and the captain, Tomas Vane, would be the first to object, loudly, to being forgotten. He and his daughter Clara, twenty-six and very nearly his equal with a boule, made the final playing the purest shooting pétanque the club has seen in years, blasting their way through the top half of the draw with a fearlessness that had the gallery gasping and the pointers quietly worried.",
      ),
      T(
        "\"We lost to patience,\" Vane said afterwards, with the rueful grace of a man who has lost to Margaret many times and learned how to do it. \"We always lose to patience, in the end. One day I'll learn.\" He will not, and everyone hopes he never does, because a club needs its great shooter as much as its great pointer, and the long argument between the Vanes' nerve and Margaret's patience is, more than any trophy, the thing that keeps this club honest. Clara, for her part, has been named the club's most improved player, and is being spoken of, already, as a regional prospect.",
      ),
    ]),

    page([
      H("Forty-Seven Years of an Ugly Cup", "History", "section"),
      T(
        "The Kawau Cup trophy was purchased in 1978 for, by the treasurer's surviving records, four dollars and fifty cents, from a closing-down sale at a trophy shop that was itself going out of business — which may explain a great deal about the cup. It is dented, mismatched, and topped with a small silver figure that is almost certainly a golfer. The club has been offered a handsome replacement on three separate occasions and has refused, with increasing indignation, every time.",
      ),
      T(
        "Its winners are a roll-call of the club's history, scratched by hand into the base by each champion in turn, the engraving growing less legible and more beloved with every year. Margaret's name appears on it four times now, across three decades. Daniel's appears for the first time. He has asked Margaret to do the engraving, on the grounds that his hands, so steady with a boule, shake at the thought of marking the cup. She has agreed. It is, she says, the proper order of things.",
      ),
    ]),

    page([
      H("Honours", "Results", "section"),
      Img(
        img.group,
        "Champions, runners-up, and everyone who stayed for the photograph.",
      ),
      T(
        "Kawau Cup — Winners: M. Ellery & D. Ross. Runners-up: T. Vane & C. Vane. Losing semifinalists: A. Okafor & J. Pratt, and the Tuesday-twilight pair of R. Sands and his grandson, whose run to the last four was the feel-good story of the day until it was comprehensively overshadowed by the final.",
      ),
      T(
        'Best newcomer of the year, awarded by the committee on the night: D. Ross, unanimously, with the citation noting that he is "no longer, by any reasonable definition, a newcomer, but we are giving it to him anyway and he can hardly object." Most improved: C. Vane.',
      ),
      T(
        "The full ladder and the complete Cup draw are pinned in the clubhouse, beside the cup itself, where the ugly little thing will sit, gleaming and golf-topped, until someone takes it off them next summer.",
        "s",
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        'Beyond the Cup, the summer ladder closed with the long-awaited changing of the guard: Daniel Ross finished the season top of the club ladder for the first time, a single point clear of Margaret, with the captain — for the first summer in five — back in third. "It had to happen," said Vane, generously. "I\'d just rather it hadn\'t happened to me."',
      ),
      T(
        'Margaret, asked whether being passed on the ladder by her own apprentice stung, considered the question with her usual care. "I taught him to do exactly that," she said. "It would be a poor sort of teaching if it hadn\'t worked." Then, after a pause: "It stings a little." It was, the committee agreed, the most human thing she has said in print.',
      ),
      T(
        "Regional championship: the club will, for the first time in eleven years, send a pairing to the autumn regionals. Pairing: A. Okafor & D. Ross. Organiser of the trip: to be confirmed, loudly, in spring.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "The Kawau Cup is played, fed and watered each year on the goodwill of the businesses below, who between them supply the prizes, the boules and a good deal of the afternoon tea. The ugly cup raises a battered silver toast to them.",
      ),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
      Spon("The Cochonnet Café"),
    ]),
  ]);
