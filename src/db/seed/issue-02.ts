import {
  cover,
  H,
  Img,
  mkIssue,
  Mont,
  page,
  type SeedImages,
  Spon,
  T,
} from "./builders";

// No. 2 — Aperture. An image-led camera-club quarterly on the modern theme:
// full-width pictures with working captions, short standfirsts, XL pull-text,
// and a portrait print run at half width. Shows the reader carrying photography
// rather than prose. It also carries the montage example (content v4, issue
// #95) — a camera club is where a cross-fading sequence belongs.
export const issue02 = (img: SeedImages) =>
  mkIssue(2, "Aperture — The Winter Salon", "modern", "2025-07-19", [
    cover([
      H("Aperture", "The Camera Club Quarterly · Winter Salon"),
      Img(img.silver, {
        alt: "Diagonal bands of charcoal, slate and one amber stripe on a pale ground.",
        width: 70,
      }),
      T("Forty-one prints. One wall. No apologies."),
    ]),

    page([
      H("The Winter Salon", "From the Selectors", "main"),
      T(
        "Every July the club hangs its best work in the supper room and lets the members say what they think, which they do, at length. This year forty-one prints made the wall from one hundred and six entries. The selectors' notes follow — the photographers' own words where we could get them, and our unrepentant opinions where we could not.",
        "l",
      ),
      Img(img.amber, {
        caption: "Best in Show — “Corner Shop, 6 a.m.”, R. Okafor.",
        alt: "A grid of quarter-circle shapes in charcoal, slate and amber, like shop awnings at dawn.",
      }),
      T(
        "Okafor waited three winters for this light. The judges' card said simply: worth it.",
        "s",
      ),
    ]),

    // The full-bleed plate (content v6, issue #227): one image set to fill the
    // page, alone on it. No caption and no running footer — the photo owns the
    // whole canvas — so the alt text is the only description it carries.
    page([
      Img(img.salon, {
        alt: "A tall duotone study in charcoal and slate, cut by a single amber seam.",
        align: "page",
      }),
    ]),

    page([
      H("Light, Found and Kept", "Portfolio", "section"),
      Img(img.gridlight, {
        caption: "“Streetlamps Coming On”, M. Vance — Highly Commended.",
        alt: "A field of dots swelling and warming toward a bright focal point, like lamplight in fog.",
      }),
      T(
        "Vance shoots the same four streets every evening in the week the clocks change, when the lamps come on into a sky that has not quite given up. What looks like patience is closer to stubbornness, and the selectors mean that as the highest compliment available to a photographer.",
      ),
    ]),

    // The montage page (content v4): three frames on a 5-second cross-fade,
    // each with its own alt text. In the readers it cycles and takes prev/next
    // from the member; in the PDF it prints the first frame only.
    page([
      H("Three Ways with One Roll", "Portfolio", "section"),
      Mont(
        [
          {
            image: img.contact,
            alt: "A contact sheet of charcoal and slate triangles, one frame warmed amber.",
          },
          {
            image: img.latent,
            alt: "Concentric contour rings closing on a pale centre, like an image surfacing in the developer.",
          },
          {
            image: img.fixer,
            alt: "Overlapping amber arcs on slate, the sequence settled and fixed.",
          },
        ],
        {
          caption:
            "“Development”, K. Iversen — the same negative at three stages, shown in sequence.",
        },
      ),
      T(
        "Iversen printed one negative three times and hung the results side by side, which is the sort of thing that starts an argument in a supper room. The point, she says, is that a photograph is not finished when the shutter closes; it is finished when somebody decides to stop working on it, and that decision is the picture.",
      ),
    ]),

    page([
      H("The Long Exposure", "Portfolio", "section"),
      Img(img.stillness, {
        caption:
          "“Harbour, Four Minutes”, E. Tan — the print everyone argued about.",
        alt: "A tall grey landscape: a pale sun over soft ridgelines fading into mist.",
        align: "right",
        width: 46,
      }),
      T(
        "Four minutes of open shutter turned a working harbour into fog and suggestion, and the room split cleanly in two: those who called it the best print of the decade and those who called it a lovely photograph of nothing. Tan, asked to adjudicate her own defence, shrugged and said the water had been doing it all along; she had only agreed not to interrupt.",
      ),
      T(
        "We reproduce it here at less than half a page, which is a scandal, and invite you to stand in front of the real thing before the wall comes down.",
      ),
    ]),

    page([
      T("A photograph is a decision about what deserves to be kept.", "xl"),
      T(
        "— from the judge's closing remarks, this year as every year, because nobody has ever put it better.",
        "s",
      ),
    ]),

    page([
      H("Next Quarter", "Club Notes", "section"),
      T(
        "The spring brief is a single word: thresholds. Doors, gates, low tide, first light, retirement — take it wherever it goes, but take it somewhere. Prints to the supper room by the last Friday of October. The darkroom rota, as ever, favours those who clean the trays.",
      ),
      T(
        "Our thanks to the framers, who once again straightened forty-one arguments into one level wall.",
        "s",
      ),
      Spon("Meridian Camera & Optical", "https://example.com"),
    ]),
  ]);
