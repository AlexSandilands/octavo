import type { ReactNode } from "react";
import { SheetFrame } from "./sheet-frame";
import { getSettings } from "@/server/settings";

// SheetFrame with the branding resolved on the server, for the pages that can
// await it (every one but the error boundaries).
export async function SheetPage({
  children,
  width,
  footer,
}: {
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
}) {
  const { org } = await getSettings();
  return (
    <SheetFrame org={org} width={width} footer={footer}>
      {children}
    </SheetFrame>
  );
}
