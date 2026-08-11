# Self-hosted fonts

The three families the magazine sets type in, committed as woff2 so that no build
needs a network round-trip to Google (issue #167). They are loaded by
`src/app/layout.tsx` through `next/font/local`; nothing else references them.

Each file is the same face, at the same version, that `next/font/google` was
downloading at build time before the swap — see "Verification" for how that was
checked. Re-fetching or upgrading one is a deliberate act, not a build step.

## What is here

| File                      | Family         | Version          | Covers                |
| ------------------------- | -------------- | ---------------- | --------------------- |
| `newsreader-roman.woff2`  | Newsreader     | v26 (font 1.003) | wght 200–800, upright |
| `newsreader-italic.woff2` | Newsreader     | v26 (font 1.003) | wght 200–800, italic  |
| `hanken-grotesk.woff2`    | Hanken Grotesk | v12 (font 3.013) | wght 100–900          |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono  | v20 (font 2.3)   | 400 (no variable cut) |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono  | v20 (font 2.3)   | 500 (no variable cut) |

All three families are SIL Open Font License 1.1; the licence text sits beside the
files it covers (`OFL-*.txt`), fetched from
`https://raw.githubusercontent.com/google/fonts/main/ofl/<family>/OFL.txt`.

## Where the source files came from

Upstream TTFs, listed by `https://fonts.google.com/download/list?family=<Family>`
(that endpoint is what turns a family name into the current versioned URLs — run it
again if these 404, which means Google has published a newer version):

- Newsreader upright — `https://fonts.gstatic.com/s/newsreader/v26/cY9AfjOCX1hbuyalUrK479n4jaBGNpY.ttf`
- Newsreader italic — `https://fonts.gstatic.com/s/newsreader/v26/cY9CfjOCX1hbuyalUrK439vyiYJDJpahZQ.ttf`
- Hanken Grotesk — `https://fonts.gstatic.com/s/hankengrotesk/v12/ieVn2YZDLWuGJpnzaiwFXS9tYupa7dGTCTs5.ttf`
- IBM Plex Mono Regular — `https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n5igg1l9kn-s.ttf`
- IBM Plex Mono Medium — `https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJ8ldPg-IUDNg.ttf`

## Rebuilding

Needs `fonttools[woff]` and `brotli`. Two things about the recipe are load-bearing:

**Newsreader carries an optical-size axis, and Google pins it at 16.** Google Fonts
instances `opsz` to 16 when the stylesheet request names no `opsz` — which is what
`next/font/google` asked for. The font's own `fvar` default is 18, and shipping that
instead narrows every advance by about 4%, which would silently repaginate every
issue laid out against the old metrics. Pin 16.

**The subset is `latin` + `latin-ext`.** The app declared `subsets: ["latin"]`, but
`next/font/google` downloads every subset a family publishes regardless, so the site
has always had latin-ext available — and it needs it: Māori place names carry
macrons (ā ē ī ō ū), which live in latin-ext and would otherwise drop to Georgia
mid-word. Vietnamese and Cyrillic are the subsets deliberately left behind.

```sh
LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0309,U+0323,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
LATIN_EXT='U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

# Newsreader only: pin the optical-size axis before subsetting.
python -m fontTools.varLib.instancer -o roman-opsz16.ttf Newsreader.ttf opsz=16
python -m fontTools.varLib.instancer -o italic-opsz16.ttf Newsreader-Italic.ttf opsz=16

pyftsubset <input>.ttf --output-file=<output>.woff2 \
  --flavor=woff2 --layout-features='*' --unicodes="$LATIN,$LATIN_EXT"
```

## Verification

The swap was checked against the files the previous `next/font/google` build had
downloaded into `.next/static/media` (all 20 of them re-fetched byte-identically
from `fonts.gstatic.com` using next's own Chrome/104 user agent, then compared):

- every codepoint Google served is present here — no coverage lost;
- **every advance width is identical**, so line breaking and page pagination are
  unchanged, which is why this swap needs no `RENDER_VERSION` bump;
- `unitsPerEm`, the OS/2 and hhea vertical metrics, and the variable axis ranges
  all match;
- outlines match after decomposition except for three control points (`6`, `đ`,
  `₫`) that differ by 1 unit out of 2000 em — instancer rounding, well under a
  pixel at any size the magazine sets.
