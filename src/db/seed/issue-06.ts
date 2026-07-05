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

// No. 6 — Kiln & Wheel. A pottery guild annual on the modern theme with a warm
// terracotta palette: craft long-form, images at three different widths and
// both wrap sides, a wide banner, and a members'-show roundup. The "maker's
// annual" archetype, and the newest issue in the library.
export const issue06 = (img: SeedImages) =>
  mkIssue(6, "Kiln & Wheel — The Guild Annual", "modern", "2026-06-20", [
    cover([
      H("Kiln & Wheel", "The Potters' Guild Annual"),
      Img(img.glaze, {
        alt: "Quarter-circle tiles in terracotta, umber and sea-green, like glaze test chips.",
        width: 65,
      }),
      T(
        "A year at the wheel, a night at the kiln, and the glaze that almost worked",
      ),
    ]),

    page([
      H("The Year in the Studio", "Guild Notes", "main"),
      T(
        "The guild threw, by the studio logbook's count, a little over two tonnes of clay this year, and returned a respectable fraction of it to the recycling bin with the special serenity that pottery teaches and no other hobby does. We gained eleven new members, lost one kiln element at the worst possible hour, and held the winter firing that this annual exists chiefly to describe.",
        "l",
      ),
      T(
        "New members should know the studio's two standing rules: the last person out checks the kiln switches, and nobody — nobody — touches another potter's ware board. Everything else is negotiable over tea.",
      ),
    ]),

    page([
      H("The Glaze That Almost Worked", "Technique", "section"),
      Img(img.wheel, {
        caption: "Test rings from the tenmoku trials — forty-one of them.",
        alt: "Concentric rings in umber and terracotta around a green centre, like a thrown pot seen from above.",
        align: "right",
        width: 40,
      }),
      T(
        "Marta's pursuit of a local-ash tenmoku entered its third year with the now-traditional forty-one test rings, each numbered, each logged, and each — she wishes it recorded — fired on the same shelf of the same kiln, because science. Rings twelve through fifteen produced a breaking amber over iron that stopped visitors mid-sentence. Ring sixteen, identical in every logged respect, produced the colour of a wet pavement.",
      ),
      T(
        '"That\'s glaze chemistry," she says, with the calm of a woman who has already mixed the next batch. "The kiln gets a vote. The ash gets a vote. You get a suggestion." The recipe, as it stands and with all its warnings, is chalked on the studio board — the guild does not keep secrets, only variables.',
      ),
    ]),

    page([
      H("The Night Firing", "The Kiln Diary", "section"),
      Img(img.emberfield, {
        caption:
          "Hour six: cones bending, thermocouple arguing, nobody asleep.",
        alt: "A wide banner of dots glowing from pale to deep green across a warm clay ground.",
      }),
      T(
        "The winter wood firing ran eleven hours through the coldest night of the year, staffed in two-hour watches by members who had all, without exception, described the rota as 'no trouble at all' in November and revised that position by 3 a.m. The kiln reached temperature at dawn, on schedule, to applause too tired to be loud.",
      ),
      T(
        "Opening day, four days later, drew the whole guild. It always does. However long you have potted, the moment the bricks come down is the same: everything you made has been somewhere you could not follow, and has come back changed.",
      ),
    ]),

    page([
      H("The Members' Show", "Exhibition", "section"),
      T(
        "The annual show filled the arts centre's long room for a fortnight in May: ninety pieces, eleven first-time exhibitors, and a visitors' book that ran to complimentary essays. The people's choice ribbon went to Deshi's woodfired jar from the night firing — hour six's work, ash-kissed on one shoulder exactly where the flame path said it would be.",
      ),
      T(
        "Sales covered the kiln element, the new wedging table, and the good biscuits for a year. Every unsold piece went home wrapped in newspaper and mild disbelief.",
        "s",
      ),
    ]),

    page([
      H("Firings & Thanks", "The Year Ahead", "section"),
      T(
        "Next year's calendar is chalked by the door: raku on the solstice, the members' show in May, and the night firing in the depth of winter, as ever. The beginners' wheel course resumes in February and is, as ever, full — the waiting list is the guild's most reliable kiln god.",
      ),
      Spon("Fenwick Clay & Kiln Supply", "https://example.com"),
      T(
        "Kiln & Wheel is set, thrown and fired annually by the guild. Errors are the editor's; glazes are the kiln's.",
        "s",
      ),
    ]),
  ]);
