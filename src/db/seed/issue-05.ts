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

// No. 5 — Autumn 2025. The far rink is dug up at last; Daniel, who drives a
// digger for a living, runs the job; the fund is within sight of target.
export const issue05 = (img: SeedImages) =>
  mkIssue(5, "Drainage & Other Dramas", "modern", "2025-03-15", [
    cover([
      H("Drainage & Other Dramas", "Autumn 2025"),
      Img(img.terrain, "", "full", 64),
      T("Mud, money, machinery — and a rink reborn"),
      T("Autumn 2025"),
    ]),

    page([
      H("The Season We Dug a Hole", "Editorial", "main"),
      T(
        "For three years this magazine — young as it is — has carried the far rink's slow decline as a kind of background hum: a sentence here, an appeal there, a photograph of standing water that nobody much wanted to look at. This issue, the hum becomes the headline. In March, the diggers came, and the far rink — beloved, hopeless, forty-six years old — became, for six muddy weeks, a rectangular hole in the ground.",
      ),
      T(
        "It is a strange thing to celebrate the destruction of something you love, but that is what this is. The old surface had to die for the new one to live, and there is a kind of club-wide catharsis in finally taking a machine to a problem we had spent three winters merely mopping. The whole thing was made possible by your generosity, by a remarkable run of volunteer weekends, and — not least — by the happy accident of having recruited, eighteen months ago, a newcomer who happens to dig holes for a living.",
      ),
      T("What follows is the diary of a hole, and the people who dug it.", "l"),
    ]),

    page([
      H("The Dig Begins", "Project", "main"),
      T(
        "On the first Saturday of March, a five-tonne excavator was reversed off a trailer at the gate by Daniel Ross, who then spent the next two days demonstrating to an enthralled and largely useless gallery exactly why one should leave the digging to people who dig.",
        "l",
      ),
      Img(
        img.measure,
        "Setting the new levels with a borrowed laser.",
        "right",
        42,
      ),
      H("The Plan", "", "paragraph"),
      T(
        "The plan, drawn up over winter by our retired civil engineer and checked by the contractor below, was straightforward in principle and filthy in practice: strip the dead surface and the clogged old base entirely; dig down half a metre; lay a bed of coarse drainage stone over new perforated pipe; then build back up in graded layers, each rolled and watered and rolled again, to a surface that would shed water instead of drinking it. Eleven tonnes of crushed stone were ordered. They looked, on delivery, like considerably more than any of us had pictured.",
      ),
      H("The First Weekends", "", "paragraph"),
      T(
        "Twelve volunteers signed up for the first weekend. Three wheelbarrows, two of them with flat tyres, were located. One borrowed laser level — the single most argued-over object in the club's history — was set up, knocked over, and set up again. By Sunday evening we had, triumphantly, a hole. By the second weekend, a graded bed waiting for stone. Progress, in earthworks, is measured in the absence of disaster, and we had so far avoided disaster, which felt like a great deal.",
      ),
    ]),

    page([
      H("Diary of a Hole", "Project", "section"),
      Img(
        img.terrain,
        "Week two: the bed in, the pipe laid, the rain holding off — just.",
        "left",
        45,
      ),
      T(
        'Week one. Strip and dig. Daniel on the machine; the rest of us on barrows, learning the hard way that a wheelbarrow of wet spoil weighs roughly as much as a wheelbarrow of regret. Margaret supervised from a folding chair, brought scones, and pronounced the whole enterprise "long overdue and probably doomed," which is, from her, a blessing.',
      ),
      T(
        'Week two. Pipe and stone. The drainage pipe went in along a fall so slight that it was invisible to the eye and obvious to the laser, and the gallery learned a new word — "gradient" — and used it incessantly for the rest of the month. The first eleven tonnes of stone went into the hole and, alarmingly, did not fill it; a further four were ordered, and the fund, which had been so comfortably ahead, suddenly looked human again.',
      ),
      T(
        "Week four. Build-up and roll. Layer on layer, each one wetted and compacted, the rink rising back toward the level of its neighbour like a tide coming in. On the last Sunday, for the first time, you could stand at one end and see a flat, true, finished-looking surface, and a small cheer went up that frightened the gulls off Johnson's rink next door.",
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "Daniel's Diary", "section"),
      T(
        "Autumn. A strange entry to write, because for the first time since I started I have spent a whole month at the club without throwing a single boule. I have, instead, run the rebuild of the far rink, which is the first time in my eleven years of operating machines that the machine and the people have been, so to speak, on the same side.",
      ),
      T(
        "Here is the thing nobody warned me about. I came to this club to learn a game from people who knew more than me about everything. For one month, on this one thing, I knew more than everyone — more than the engineer, more than the captain, more, even, than Margaret — and they let me lead, without a fuss, the way you hand someone the tape because it is their turn to measure. I have never in my life felt so completely a part of something. I think this is what Greg was setting people up for, all those years, with his spare boules. Not the game. This.",
      ),
      T(
        'Margaret, watching me bring the last layer up dead level, said only, "You read ground for a living. No wonder you took to pointing." I have decided to treat that as the highest compliment I have ever received, because I am fairly sure that is what it was.',
      ),
    ]),

    page([
      H("From the Terrain", "Technique", "main"),
      T(
        "We promised, in summer, to return to the shot — and the Verralls have now finished their winter tutorial of Daniel, so we can report on a method tested against an actual improving beginner rather than merely asserted by two enthusiasts.",
        "l",
      ),
      Img(
        img.boules,
        "Eyes on the ground a hand in front of the target, not the target itself.",
        "right",
        38,
      ),
      T(
        "The shooter's secret, the Verralls insist and Daniel confirms, is where you look. The instinct is to stare at the boule you mean to hit. Resist it. Fix your eye instead on a point on the terrain a hand's-width in front of your target — the spot you want your own boule to strike first — and throw flat and firm at that. The boule arrives on a low arc, lands on your chosen spot, and carries through into the target with the pace still on it. Aim at the boule and you will hit the ground short; aim at the ground and you will hit the boule.",
      ),
      Img(img.measure, "", "left", 35),
      T(
        'The other half of it is simply nerve, which cannot be taught, only accumulated. "You miss the first hundred," says the elder Verrall, cheerfully. "You make the second hundred about one time in five. Somewhere in the third hundred your body stops asking your brain for permission, and that is when you can call yourself a shooter." Daniel, by his own count, is somewhere in the second hundred. Amara Okafor, everyone agrees, finished the third some time ago.',
      ),
    ]),

    page([
      H("The Twelve", "Profile", "section"),
      Img(
        img.group,
        "Most of the dig crew, filthy and delighted, on the last Sunday.",
      ),
      T(
        "It would be wrong to let the rebuild pass without naming, at least collectively, the dozen members who gave up four weekends of their autumn to barrow stone in the rain. They were not, for the most part, the club's best players — the best players, it must be said, found a remarkable number of reasons to be elsewhere — but they were its best people, and the new rink is, in the most literal sense, built by their hands.",
      ),
      T(
        "Their average age, the committee notes with a mixture of pride and alarm, was sixty-three. The oldest was seventy-one. They lifted, between them, something north of fifteen tonnes of stone, one barrow at a time, and the only injury of the entire project was a single pulled hamstring, sustained not on the dig but in the celebratory game of boules that followed it.",
      ),
    ]),

    page([
      H("Notes from the Mud", "Club Life", "section"),
      T(
        "A miscellany from the rebuild, set down before it fades. Joan's field kitchen, run from the back of the clubhouse, produced an estimated two hundred cups of tea and a soup so restorative that two volunteers admitted to coming back the second weekend mainly for the lunch. The honesty box, left out in the rain, survived. The borrowed laser level, against all odds and several near-misses, was returned to its owner intact, though no longer quite speaking to anyone.",
      ),
      T(
        'And there was a moment, on the final Sunday, that the whole crew has since agreed was the best of it: Margaret, who had supervised every weekend from her folding chair and lifted not one single stone, walked out onto the new bed, crouched, laid her palm flat on the fresh-rolled surface, and said, "Yes. That will play." Forty years of reading the ground, in four words. Daniel says he will dine out on it for the rest of his life.',
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        "Competition took, understandably, a back seat to construction this quarter, and the autumn ladder restart has been pushed to coincide with the new rink's opening. The only silverware contested was the Mud Cup — a jar of nails, awarded by acclamation to Daniel for services to the hole — which now sits in pride of place behind the bar.",
      ),
      T(
        "Far-rink fund: $5,840, against a revised target of $6,400 after the extra stone. The committee is, for the first time, confident of closing the gap before the opening, and quietly confident that the anonymous donor will, as ever, make up any shortfall the moment our backs are turned.",
      ),
      T(
        "Hamstrings pulled during the rebuild: one. During the game afterwards: also one. Same hamstring. Same member. He has asked not to be named and we have, reluctantly, agreed.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "The firm below did the heavy machine work the volunteers could not, at a rate so far below commercial that the committee has been sworn to secrecy about it, and supplied the operator — well, lent us back our own. The club's debt to them is structural, in every sense.",
      ),
      Spon("Coastline Earthworks"),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
    ]),
  ]);
