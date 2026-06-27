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

// No. 9 — Autumn 2026. The club's first regional championship in eleven years:
// Okafor and Ross finish fourth of nineteen, and come home heroes.
export const issue09 = (img: SeedImages) =>
  mkIssue(9, "Travelling Boules", "modern", "2026-03-14", [
    cover([
      H("Travelling Boules", "Autumn 2026"),
      Img(img.group, "", "full", 78),
      T("The club takes to the road — and nearly takes the regionals"),
      T("Autumn 2026"),
    ]),

    page([
      H("Out of the Bay", "Editorial", "main"),
      T(
        "For eleven years this club kept itself to itself. We played our doubles, contested our Cup, argued our endless argument between patience and nerve, and sent nobody to the regional championship, on the not-unreasonable grounds that we had nobody likely to trouble the bigger clubs and no great wish to be embarrassed three hours from home. This autumn, for the first time since, we packed the cars, made the sandwiches, and went.",
      ),
      T(
        "We did not win. Let us say that plainly and early, because the temptation of a report like this is to bury the result under the romance of the road trip. We finished fourth of nineteen — which, for a club our size, sending a pairing barely two seasons in the making, is a result so far beyond our hopes that we said so, loudly and continuously, the entire three hours home. This is the story of how Amara Okafor and Daniel Ross took a small bay club to the edge of the regional podium, and of what the rest of us learned standing on the rail in the cold, watching them do it.",
      ),
      T(
        "It turns out the bigger clubs are not braver. Only better drilled. That is a fixable problem, and we intend to fix it.",
        "l",
      ),
    ]),

    page([
      H("On the Road", "Away", "main"),
      T(
        "Four cars, eleven players, two reserves who were really just along for the trip, and one chilly bin of sandwiches built by Joan to a scale that suggested she expected the championship to last a week, left the clubhouse at six in the morning under a sky the colour of a boule.",
        "l",
      ),
      Img(
        img.building,
        "The regional grounds: grand, historic, and a good deal colder than ours.",
        "right",
        45,
      ),
      T(
        "The regional grounds are everything our club is not: vast, manicured, overlooked by a grand old pavilion, and slightly intimidating to a party of bay-dwellers who are used to a clubhouse you could fit in the pavilion's cloakroom. There were nineteen clubs entered, some of them four times our size, several of them carrying players who compete nationally. Our entire travelling support could, and did, fit on a single bench. We brought, in lieu of numbers, a quantity of noise that several rival clubs found frankly startling.",
      ),
      T(
        'Okafor and Ross had drawn a hard group, and the early word from the bigger clubs — relayed to us with the kind tactlessness of people who do not expect to be overheard — was that the bay pair were "a nice story" who would "enjoy the day out." We have rarely been so happy to be underestimated, and Amara, who heard every word, has since admitted she played the entire first day on pure spite.',
      ),
    ]),

    page([
      H("Fourth of Nineteen", "", "paragraph"),
      T(
        "They came through the group second, then won a quarter-final against a fancied town club on a last-end carreau from Amara so clean that the opposing skip applauded it himself. The semi-final, against the eventual champions, they lost thirteen to ten — but they led it, briefly, at nine-eight, and for two or three ends the whole regional ground drifted over to watch the small bay club giving the favourites a genuine fright. The play-off for third they lost narrowly, with tired arms, to a club that has been to the nationals. Fourth of nineteen. The bench went, by all accounts, completely feral.",
      ),
      Img(
        img.measure,
        "Amara's quarter-final carreau, measured for the record books.",
      ),
      T(
        "What turned heads was not that they reached the last four — upsets happen — but how they played to get there: Daniel's patient, ground-reading pointing building the heads, and Amara's ferocious, ice-cold shooting clearing them when they needed clearing. Pointer and shooter, patience and nerve, the club's whole long argument resolved at last into a single pairing that played both halves of it. Margaret, watching from the rail, said almost nothing all day. At the final whistle she said, \"That's the club. That's the whole club, in two people.\" Then she went and sat in the car.",
      ),
    ]),

    page([
      H("The Newcomer's Notebook", "Daniel's Diary", "section"),
      T(
        "Autumn. I have played in a regional semi-final. Two and a half years ago I could not land a boule on the rink, and on Saturday I pointed against the best pair in the region with the whole ground watching, and I held my nerve, mostly, and we lost by three, and it is the proudest defeat of my life.",
      ),
      T(
        "The thing I keep turning over is how ordinary the big clubs turned out to be, up close. I had built them up into something superhuman. They are not. They are people who have practised the same shot ten thousand times until their hands do it without asking, and that is all, and it is everything, and it is completely learnable. We are not worse than them because we are a small bay club. We are worse than them because they practise the tir on Tuesdays while we stand by the fire arguing about it. Amara has been saying this for a year. I finally believe her.",
      ),
      T(
        'On the drive home, in the dark, somewhere around the second hour, Margaret — who had said almost nothing all day — spoke up from the passenger seat. "You read the ground out there like you\'d built it," she said. "Which, in a way, you have." Then she went back to sleep. I drove the rest of the way home grinning at the motorway like an idiot.',
      ),
    ]),

    page([
      H("What We Learned", "Reflection", "section"),
      T(
        "Defeats teach more than wins, and a fourth-of-nineteen taught us a great deal. That the bigger clubs are not braver, only better drilled — that their edge is not talent or nerve but repetition, the same shots grooved on the same Tuesdays until pressure cannot disturb them. That Daniel can hold his nerve in a semi-final, which not even Margaret was certain of beforehand. And that Amara Okafor, on her day, is the best shooter this club has produced in a generation, and possibly the best it has ever had.",
      ),
      Img(img.measure, "", "left", 38),
      T(
        'The committee has taken the lesson to heart. From this winter, the Tuesday twilights will include a structured shooting practice — a chalk circle, a rotation, a target, and an end to the long tradition of practising the tir purely by arguing about it. "Next year," said the captain, to nobody in particular and everybody in general, on the drive home, "we practise." It is the most useful thing he has said as captain, and he said it half-asleep.',
      ),
    ]),

    page([
      H("Ice in the Hands", "Profile", "section"),
      Img(img.measure, "", "right", 40),
      T(
        "If this issue belongs to anyone, it belongs to Amara Okafor, the theatre nurse who learned the game backwards — shooting before she could point, which everyone said was wrong — and who carried the bay's colours to the edge of a regional podium on the strength of the steadiest shooting hand the club has seen. She played, by the tournament's official count, eleven carreaux across the day, a figure that several rival skips refused to believe until they checked the score sheets.",
      ),
      T(
        '"People ask where the nerve comes from," she says, "and I tell them: in my work, your hands have to stop shaking on command, with much more than a boule on the line. After that, a regional semi-final is almost relaxing." She is, the committee believes, a genuine national prospect — the first this small club has produced — and the only real question now is whether the bay can keep her as the bigger clubs, who saw exactly what she did on Saturday, inevitably come calling. "I\'m not going anywhere," she says. "They\'ve got better rinks. They haven\'t got Margaret, or Joan\'s soup, or Daniel building me heads to shoot off. Why would I leave?"',
      ),
    ]),

    page([
      H("The Long Way Home", "Club Life", "section"),
      Img(
        img.group,
        "The travelling party, fourth-placed and entirely insufferable, at the last services.",
      ),
      T(
        "There is a particular joy to the drive home from an away tournament that went better than anyone dared hope, and the bay party extracted every last drop of it. Four cars, loosely in convoy, three hours of replaying every end in increasingly heroic detail, one emergency stop for hot chips at a services where the travelling support attempted, and largely failed, to explain to a baffled cashier exactly why a fourth-place finish warranted this much celebration.",
      ),
      T(
        'By the time the convoy rolled back into the bay, well after dark, the result had grown in the retelling to something close to a triumph, the favourites we lost to had become "lucky," and a firm collective decision had been reached to enter two pairings next year. None of this will survive the cold light of the next committee meeting. All of it was, for three hours on a dark motorway, completely and gloriously true.',
      ),
    ]),

    page([
      H("Results & the Ladder", "The Measure", "section"),
      T(
        "Regional Championship — A. Okafor & D. Ross: 4th of 19, losing the third-place play-off after a semi-final defeat to the eventual champions (10–13). Best result by a club pairing at the regionals since 2015, and the first top-four finish in the club's history.",
      ),
      T(
        "Carreaux landed by A. Okafor across the day, by official count: eleven. Rival skips who refused to believe it: at least four. Clubs who have since, we are reliably informed, made enquiries about her availability: at least two. Her response to all enquiries: see the profile opposite.",
      ),
      T(
        'The autumn club ladder restarts next week. Daniel Ross begins it as defending leader; Margaret, asked her ambitions for the season, said only, "To enjoy it," which from her is either deeply uncharacteristic or quietly ominous. We shall see in winter.',
        "s",
      ),
    ]),

    page([
      H("With Thanks", "Our Patrons", "section"),
      T(
        "The regional trip — the fuel, the entry fees, and the legendary chilly bin — was underwritten by the businesses below, who backed a long shot and were rewarded with the best result in the club's history. We could not have gone without them, and we will not, now, stop going.",
      ),
      Spon("Kawau Bay Hardware"),
      Spon("The Cochonnet Café"),
    ]),
  ]);
