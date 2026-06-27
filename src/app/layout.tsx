import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Club Magazine",
  description: "A members-only digital magazine.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
