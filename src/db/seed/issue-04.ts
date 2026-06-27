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

// No. 4 — Summer 2024. The long lunch; the fund grows; the club mourns Greg
// Johnson, after whom the near rink is named.
export const issue04 = (img: SeedImages) =>
  mkIssue(4, "The Long Table", "classic", "2024-12-14", [
    cover([
      H("The Long Table", "Summer 2024"),
      Img(img.group, "", "full", 78),
      T("The whole club, at table, for a day"),
      T("Summer 2024"),
    ]),

    page([
      H("A Day Off from the Game", "Editorial", "main"),
      T(
        "Once a summer, and only once, the club puts the boules away for a whole day. The trestle tables come out of the shed where they spend eleven months gathering spiders, they are wiped down and set end to end the length of the clubhouse veranda, and the season — for one long, lazy, over-catered afternoon — simply stops. It is the most important day in the club's year, and not a single point is played.",
      ),
      T(
        "This summer's table was the longest in memory, swollen by our record membership and by a number of people who, it must be said, are far keener on the lunch than the game. They are welcome too. A club is not only its competitors; it is also its cooks, its talkers, its keepers of the soup tin, and the handful of souls who turn up reliably to clap and have never thrown a boule in their lives.",
      ),
      T(
        "It was, this year, a day shadowed by a loss — but a loss best honoured, we decided, exactly as Greg would have wanted: loudly, and over a long lunch.",
        "l",
      ),
    ]),

    page([
      H("The Longest Lunch", "Club Life", "main"),
      Img(
        img.group,
        "Forty-odd of us, and a table built for thirty.",
        "right",
        45,
      ),
      T(
        "There was a raffle, won — scandalously, and for the third year running — by the captain, who has begun to attract dark mutterings about the integrity of the draw. There was a speech by the club president that began as a welcome, became a history of the harbour bridge, and was eventually brought to land by Joan ringing the soup bell. And there was, threaded through all of it, a great deal of the particular happiness that comes of sitting elbow to elbow with people you mostly only ever see at arm's length down a rink.",
      ),
      T(
        'Daniel, attending his first long lunch, was adopted bodily by the Verrall brothers and spent the afternoon being told, in stereo, that Margaret was teaching him all wrong and that what he really needed to learn was the shot. By the end of it he had agreed to a private tutorial in the new year, which Margaret, overhearing, permitted with a single raised eyebrow and the words, "It will do him good to see how the other half misses."',
      ),
    ]),

    page([
      H("Greg Johnson, 1947–2024", "In Memoriam", "section"),
      T(
        "We note, with a sorrow the whole club shares, the passing in November of Greg Johnson, a member of forty years, after a short illness borne with exactly the unfussy good humour he brought to everything else.",
        "l",
      ),
      Img(
        img.boules,
        "Greg's boules, which the family have gifted to the club's loaner box.",
        "left",
        40,
      ),
      T(
        "Greg was not, by his own cheerful admission, ever the best player at the club, or the second best, or anywhere near it. What Greg was, was the man who set up more newcomers with loaner boules than anyone alive can count — who saw the stranger hovering at the gate and crossed the whole terrain to press a boule into their hand before they could lose their nerve and leave. Half the club learned the game from Greg's spare set. The other half learned it from someone Greg first welcomed.",
      ),
      T(
        "The committee has resolved that the near rink — the one he played on most, and swept most, and complained about most — will from now on be known as Johnson's. A small brass plate is on order. He would have called it a waste of good brass, and then he would have polished it.",
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "Daniel's Diary", "section"),
      T(
        "Summer. I have now been doing this for ten months and I have just played in my first proper competition end, in a scratch doubles at the long lunch, and I want to record — warts and all, as promised — that I was so nervous I could not feel my own hand.",
      ),
      T(
        'Margaret was my partner, by a draw she swears was honest. On the last boule, with the end level, she did a thing I will never forget: she did not tell me what to do. She just looked at me, and looked at the ground, and waited. So I chose a spot — short, and to the left, where the terrain fell away — and I threw to it, the way she taught me, and the boule rolled down the slope and stopped a thumb from the jack and we won the end. She said, "There. Now you know where it lives." I have no idea what she meant and I have thought about nothing else since.',
      ),
      T(
        "I also met a man called Greg, once, in my first week, who gave me my first ever boule to hold and told me not to worry, that everyone is hopeless at the start and most stay hopeless and it does not matter in the slightest. I am very sad I will not get to tell him he was wrong about the staying-hopeless part. I hope.",
      ),
    ]),

    page([
      H("Saving the Far Rink", "Appeal Update", "main"),
      T(
        "The far rink has drained badly for three winters. It is time, and — thanks to you — it is now nearly possible.",
        "xl",
      ),
      T(
        "The appeal stands tonight at $3,910, a little under two-thirds of the way to our six thousand, and climbing faster than the committee dared hope. The quiz night alone raised $620, despite — or, the organisers suspect, because of — a music round so difficult that two tables walked out. The soup tin has become a torrent. And the anonymous donor we all suspect of being Margaret has struck twice more.",
      ),
      Img(
        img.terrain,
        "The far rink in December: dry now, but the damage is in the bones.",
      ),
      T(
        "If the fund reaches six thousand before autumn, Daniel — who, we may now reveal, drives a digger for the very firm that would do the work — believes the rink can be lifted, graded and re-laid before next winter's rains. The alternative is a fourth winter of the lake. Let us not have a fourth winter of the lake.",
      ),
    ]),

    page([
      H("From the Terrain", "Technique", "main"),
      T(
        "A change of subject, and a controversial one in a club this fond of pointing: the shot. We have spent three issues on the patient art of placing a boule. Now, with winter and the Verralls' tutorials looming, a first word on the violent joy of removing one.",
        "l",
      ),
      Img(
        img.measure,
        "A clean carreau: your boule stops dead where theirs sat.",
        "right",
        42,
      ),
      H("The Carreau", "", "paragraph"),
      T(
        "To shoot — to tirer — is to throw your boule directly at an opponent's and knock it clean out of the reckoning. Done badly it is a wild waste that gifts the end to a patient pointer. Done perfectly, it produces the carreau: your boule strikes theirs so squarely that it stops dead in the very spot theirs vacated, leaving you holding where they held. It is, the captain insists and Margaret grudgingly concedes, the single most satisfying thing a body can do on a terrain.",
      ),
      H("Aim at the Ground", "", "paragraph"),
      T(
        "We will return to the how of it in the winter issue, once the Verralls have finished with Daniel and we can report whether their method survives contact with an actual beginner. For now, know only this: a shooter aims not at the boule but at the ground just in front of it, and throws flat and fast and fearless. Fearless is the hard part.",
      ),
    ]),

    page([
      H("The Quiet Shooter", "Profile", "section"),
      Img(img.measure, "", "left", 38),
      T(
        "If the captain is the club's loudest shooter, Amara Okafor is rapidly becoming its best. A theatre nurse who can only make the Tuesday twilights around her shifts, she came to the game eighteen months ago with her father, learned it backwards — shooting before she could reliably point, which everyone said was the wrong way round — and has quietly developed a tir that several senior members now refuse to face in a friendly.",
      ),
      T(
        '"In my work your hands have to stop shaking on command," she says, when asked where the nerve comes from. "A boule is not a patient on a table. It is much less frightening than people here think." She and Daniel — the club\'s two most promising newcomers, arrived within a year of each other — have struck up the kind of rivalry that flatters them both, and the committee has quietly begun to imagine a doubles pairing that might, in a year or two, frighten the whole region.',
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        'Summer is the off-season for serious competition, but the scratch doubles at the long lunch — drawn from a hat, partners assigned by fate — produced its usual crop of unlikely results. Winners: M. Ellery & D. Ross, the veteran and the newcomer, in a result the captain has declared "a fix" and everyone else has declared "lovely."',
      ),
      T(
        'The summer ladder is suspended until the autumn restart, but for the record the season closed with Vane on top, Ellery second, and the gap between them — by Margaret\'s own calculation — at "one bad afternoon, his."',
      ),
      T(
        "Far-rink fund: $3,910 and rising. Quiz night profit: $620. Number of tables who walked out during the music round: two. Worth it: unanimously agreed.",
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "Greg Johnson sold hardware for thirty years before he retired, and it is no small thing that the firm below — his old employer, and now a stranger's — has marked his passing with a substantial gift to the far-rink fund. The near rink is his. So, in a quieter way, is a good part of the new far one will be.",
      ),
      Spon("Kawau Bay Hardware"),
      Spon("Hawthorn & Reed Outfitters", "https://example.com"),
    ]),
  ]);
