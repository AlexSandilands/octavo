import type { ReactNode } from "react";
import { Label, Wordmark } from "./ui";

// The lit sheet: a paper panel centred on the dark ground, the wordmark and
// the club's name standing above it. The frame for every short member-facing
// page that isn't the library or the reader — sign-in and its "check your
// email", preferences, unsubscribe, the 404 and the error boundaries — so
// they are unmistakably one site. No server imports, so a client tree (the
// route error boundaries) can render it too; SheetPage resolves the org.
export function SheetFrame({
  org,
  children,
  width = "max-w-md",
  footer,
}: {
  org: string;
  children: ReactNode;
  /** The sheet's measure — `max-w-md` for a form, `max-w-xl` for a message. */
  width?: string;
  /** Anything that belongs under the sheet, on the ground (a way back). */
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:py-14">
      <div className="mb-7 flex flex-col items-center gap-2 text-center">
        <Wordmark size={28} tone="dark" />
        <Label tone="dark">{org}</Label>
      </div>
      <div
        className={`on-paper bg-paper rounded-sheet shadow-sheet w-full ${width} p-7 sm:p-10`}
      >
        {children}
      </div>
      {footer && <div className="mt-6">{footer}</div>}
    </main>
  );
}
