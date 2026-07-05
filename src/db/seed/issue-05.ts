import {
  cover,
  H,
  Img,
  mkIssue,
  page,
  type SeedImages,
  T,
  Thtml,
  Traw,
} from "./builders";

// No. 5 — The Marginalia. A literary society's essay number on the classic
// theme: the text-heavy archetype — one sustained essay, paragraph-level
// sub-heads, a single ornamental plate, and no sponsors. Also carries the
// seed's one deliberately legacy-shaped page (see the note below).
export const issue05 = (img: SeedImages) =>
  mkIssue(5, "The Marginalia — On Lending Books", "classic", "2026-04-05", [
    cover([
      H("The Marginalia", "The Reading Society · An Essay in One Sitting"),
      Img(img.plate, {
        alt: "An engraved-style ornamental plate: concentric circles and radiating ticks inside double rules.",
        width: 42,
      }),
      T("On lending books, and the impossibility of it"),
      T("No. 5 · Read aloud on the first Thursday of April"),
    ]),

    page([
      H("On Lending Books", "The Essay", "main"),
      T(
        "There is no such thing as lending a book. There is giving a book away while pronouncing the word 'lend', and there is declining to, and every reader alive has done both while believing themselves engaged in some third, gentler transaction that does not exist.",
        "xl",
      ),
      T(
        "Consider what is actually handed over. Not paper: paper can be replaced for the price of a modest lunch. What crosses the doorway is a particular copy — the one with the coffee ring from the morning the ending ambushed you, the pencil line beside the sentence you have quoted at three funerals, the boarding pass from a life you no longer lead still marking a chapter you never finished. None of this is listed in any edition. All of it leaves the house.",
      ),
      T(
        "And it leaves, note, on the strength of the least binding contract in human affairs. A mortgage is witnessed. A library book has a date stamped in it and an institution behind the stamp. But a lent book is secured by nothing but the phrase 'I'll get it back to you', which linguists should classify not as a promise but as a pleasantry, like 'we must do this again'.",
      ),
    ]),

    page([
      H("The Borrower's Defence", "", "paragraph"),
      T(
        "The borrower, it must be said, holds none of this in bad faith. No one has ever borrowed a book intending to keep it. The book simply undergoes, on the borrower's shelf, a slow change of citizenship. For the first month it sits apart, visibly foreign, almost humming with obligation. By the sixth it has acquired neighbours. By the second year it has acquired the borrower's own coffee ring, and when at last it is discovered during a house move, the borrower experiences not guilt but a faint, fond puzzlement — the feeling of finding a photograph of a stranger at one's own wedding.",
      ),
      H("The Lender's Ledger", "", "paragraph"),
      T(
        "Meanwhile the lender keeps the only honest record of the affair: the gap. Nothing on a shelf is so visible as an absence. The eye, travelling along the spines, drops into the missing inch and stops as surely as a tongue finds the lost tooth. Ask any serious reader to name the books they have lent and watch: they will not consult a list, because the list is carved. Marquez, to a colleague, 2019. The good Persuasion, to a sister-in-law, unforgivably, 2016.",
      ),
      T(
        "The society's own survey, conducted at the winter supper with a show of hands and no anonymity whatever, found forty-one members owed a collective one hundred and thirty-eight books, while precisely four members confessed to possessing any borrowed volume at all. The mathematics of this are left, as the treasurer put it, as an exercise for the conscience.",
        "s",
      ),
    ]),

    page([
      H("A Modest Resolution", "", "paragraph"),
      T(
        "What, then, is to be done? The severe answer is a ledger by the door, and the society has a member who keeps one, and we have all seen the look on a guest's face when it is produced. The ledger works. So does moving house without telling anyone. Neither is worth it.",
      ),
      T(
        "The better answer is to complete the gift. Hand the book over and, silently, in the privacy of your own accounting, write it off. If it returns — and one in some number does return, creased in new places, smelling of someone else's kitchen — receive it as you would a traveller: gladly, and without an audit. And if it does not, console yourself with the society's oldest comfort, which is that somewhere on an unknown shelf, your pencil line waits beside the good sentence for a stranger to find, and agree.",
      ),
      T("Lend freely, mourn briefly, and buy two of anything you love.", "l"),
    ]),

    // Deliberately legacy-shaped content (issues #36/#58): this one page authors
    // its body text in the pre-v3 stored shapes — Traw() a plain string (v1),
    // Thtml() a constrained-HTML string (v2) — so a freshly seeded database keeps
    // exercising the permanent string→doc render fallback and the migration
    // script's converter, even though every other T() block is a v3 doc. These
    // render identically to a v3 block; only the stored shape differs.
    page([
      H("From the Society's Archive", "Minutes, Recovered", "section"),
      Traw(
        "A note in the plain style of our earliest newsletters, found loose in the 1987 minute book: Resolved, that the society's copy of Middlemarch, missing since the spring outing, be considered not lost but at large; and that the member last seen with it be pursued by no means sterner than the raising of eyebrows at the annual dinner. Carried without dissent, one abstention.",
      ),
      Thtml(
        "<p>And one in the <em>marked-up</em> style of our middle years: the committee reminds members that marginalia are <strong>encouraged</strong> in society copies, provided they are made <u>in pencil</u>, signed with initials, and better than the text they annotate. This last condition, the secretary notes, has historically excused almost everyone.</p>",
      ),
    ]),
  ]);
