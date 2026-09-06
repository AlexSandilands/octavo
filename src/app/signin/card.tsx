import type { ReactNode } from "react";
import { SheetPage } from "@/components/sheet-page";

// Shared frame for the sign-in flow's screens (form, sent, errors): the lit
// sheet every short member page uses.
export function SignInCard({ children }: { children: ReactNode }) {
  return <SheetPage>{children}</SheetPage>;
}
