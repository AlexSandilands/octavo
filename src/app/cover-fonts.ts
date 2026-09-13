import localFont from "next/font/local";

// Separate opt-in aliases preserve the historical faces/weights of existing pages.
const coverNewsreader = localFont({
  src: [
    {
      path: "./fonts/newsreader-roman.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./fonts/newsreader-italic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  variable: "--font-cover-newsreader",
  adjustFontFallback: "Times New Roman",
  preload: false,
});
const coverHanken = localFont({
  src: [
    {
      path: "./fonts/hanken-grotesk.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/hanken-grotesk-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-cover-hanken",
  preload: false,
});
const coverRoboto = localFont({
  src: [
    {
      path: "./fonts/roboto-condensed-roman.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/roboto-condensed-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-cover-roboto",
  preload: false,
});
export const coverFontVariables = `${coverNewsreader.variable} ${coverHanken.variable} ${coverRoboto.variable}`;
