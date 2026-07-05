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

// No. 3 — The Commons. A village-newsletter archetype on the classic theme:
// short newsy pages, a wide banner image, lots of small-size notices, and a
// cluster of local sponsors (with and without links). The "parish magazine"
// end of the product's range.
export const issue03 = (img: SeedImages) =>
  mkIssue(3, "The Commons — Spring Notices", "classic", "2025-10-04", [
    cover([
      H("The Commons", "The Village Association Newsletter"),
      T("Spring notices, the fête accounts, and a mystery resolved"),
      T("No. 3 · Spring"),
    ]),

    page([
      H("The Green, Reopened", "Village News", "main"),
      Img(img.green, {
        caption:
          "The green, back in business after six weeks of drainage works.",
        alt: "A wide abstract landscape banner: a low red sun over green ridgelines.",
      }),
      T(
        "The contractors have gone, the barriers are down, and the green is once again fit for dogs, picnics and the vigorous complaints of the boules fraternity. The association thanks everyone for six weeks of patience, and Mr. Halloran for supervising the reinstatement of the turf with an attention to detail the contractors will not soon forget.",
      ),
      T(
        "The new drainage was tested by the first weekend's rain and passed. The old pond by the war memorial, which was not drainage but had long behaved as if it were, has been formally promoted to a feature.",
        "s",
      ),
    ]),

    page([
      H("Fête Accounts & a Confession", "The Autumn Fête", "section"),
      Img(img.fete, {
        caption: "Bunting: seventy metres of it, all recovered, mostly intact.",
        alt: "Rows of triangular bunting pennants in green, rust and cream.",
      }),
      T(
        "The autumn fête raised £2,314 for the hall roof, a record, and consumed in the process one gazebo, two trestle tables and the vicar's composure. The full accounts are pinned in the hall porch. The shortfall of one cake stand float (£4.50) has been resolved: it was in the other tin. The treasurer thanks the village for three weeks of theories, some of them libellous.",
      ),
      H("Hall Roof Fund", "", "paragraph"),
      T(
        "With the fête money banked, the fund stands at £11,780 of the £15,000 needed. One more good summer should see the scaffolding up. Donations to the treasurer; suspiciously large donations to the treasurer, quietly.",
        "s",
      ),
    ]),

    page([
      H("Notices", "In Brief", "section"),
      T(
        "The mobile library resumes its fortnightly Thursday stop outside the post office, 10 until noon. New members welcome; late returns forgiven on production of a reasonable story.",
        "s",
      ),
      T(
        "Choir practice moves to Wednesdays for the winter. The tenors are asked to note that this includes them.",
        "s",
      ),
      T(
        "The footpath by Marsh Lane is passable again. Walkers are asked to keep to the line of the path and to shut the gate, which has a new latch and no further excuses.",
        "s",
      ),
      T(
        "Planning: no applications this quarter, a sentence the editor has waited four years to set in type.",
        "s",
      ),
    ]),

    page([
      H("Our Local Sponsors", "Please Support Them", "section"),
      T(
        "The newsletter is delivered free to every household in the parish because the businesses below pay for the printing. They are all of them local, and they all deserve your custom.",
      ),
      Spon("The Wheatsheaf Inn", "https://example.com"),
      Spon("Padfield & Daughters, Butchers"),
      Spon("Marsh Lane Garden Centre", "https://example.com"),
      T(
        "Copy for the summer number to the editor by the last Friday of the month, legible and, ideally, true.",
        "s",
      ),
    ]),
  ]);
