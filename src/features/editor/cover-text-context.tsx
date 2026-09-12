"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
type Target = { id: string; editor: Editor };
const Context = createContext<{
  target: Target | null;
  activate: (target: Target) => void;
}>({ target: null, activate: () => {} });
export function CoverTextProvider({
  selectedId,
  children,
}: {
  selectedId: string | null;
  children: ReactNode;
}) {
  const [target, activate] = useState<Target | null>(null);
  return (
    <Context
      value={{
        target:
          target?.id === selectedId && !target.editor.isDestroyed
            ? target
            : null,
        activate,
      }}
    >
      {children}
    </Context>
  );
}
export const useCoverText = () => useContext(Context);
