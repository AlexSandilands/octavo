"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";

type Target = { id: string; editor: Editor };
type Value = {
  /** The text editor the floating format bar acts on, if the selected item has one. */
  target: Target | null;
  activate: (target: Target) => void;
  register: (target: Target) => void;
  unregister: (editor: Editor) => void;
};
const Context = createContext<Value>({
  target: null,
  activate: () => {},
  register: () => {},
  unregister: () => {},
});

// The focused editor wins; otherwise the selected item's first text field, so
// the format bar has something to act on as soon as the item is selected.
export function CoverTextProvider({
  selectedId,
  children,
}: {
  selectedId: string | null;
  children: ReactNode;
}) {
  const [focused, activate] = useState<Target | null>(null);
  const [registry, setRegistry] = useState<Target[]>([]);
  const register = useCallback(
    (t: Target) =>
      setRegistry((r) => [...r.filter((x) => x.editor !== t.editor), t]),
    [],
  );
  const unregister = useCallback(
    (editor: Editor) =>
      setRegistry((r) => r.filter((x) => x.editor !== editor)),
    [],
  );
  const live = (t: Target | null) =>
    Boolean(t && t.id === selectedId && !t.editor.isDestroyed);
  const target = live(focused)
    ? focused
    : (registry.find((t) => live(t)) ?? null);
  return (
    <Context value={{ target, activate, register, unregister }}>
      {children}
    </Context>
  );
}
export const useCoverText = () => useContext(Context);
