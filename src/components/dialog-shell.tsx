"use client";

import { useEffect, useId, useRef } from "react";

// The one modal shell for the app (issue #130). Every dialog in the admin was a
// bare <div> over a dimmed backdrop: a screen reader got no signal that a modal
// had opened, Escape did nothing, Tab walked straight out into the page behind,
// and closing dropped focus on <body>. This owns all of it in one place —
// role/aria-modal/accessible name, Escape, the focus trap and focus restore —
// so a new dialog gets the whole contract by rendering inside it.
//
// The children are a function of the heading's id: `aria-labelledby` points at
// the dialog's own visible <h2>, so the announced name is the words on screen
// and there is no second copy to drift. Each dialog keeps its own header
// (kicker, close ×, type size), which is why the shell hands out the id rather
// than rendering the heading itself.
//
// A press on the backdrop closes the dialog, on every dialog — the owner's call
// on #130. It is the same exit as Escape and obeys the same rules: refused while
// `locked`, and focus lands back on the trigger.
//
// Hand-rolled rather than the native <dialog> element. Native would give
// modality, Escape and the top layer for free, but every dialog here treats the
// backdrop as a real element — each one closes on a press that lands on it, and
// the montage dialog additionally stops presses reaching the editor canvas
// behind — while ::backdrop is a pseudo-element you can neither listen to nor
// hit-test. Native also wants imperative showModal()/close() against a React
// tree that mounts dialogs only while open, and its user-agent box would have to
// be unpicked to keep these panels pixel-identical. The modality native would
// have given for free is done by hand instead, in `inertOutside` below (#154).
export function DialogShell({
  panelClassName,
  locked = false,
  isolatePointerEvents = false,
  onClose,
  children,
}: {
  /** Classes for the panel — every dialog keeps the box it already had. */
  panelClassName: string;
  /** An action is in flight: Escape and a backdrop press are refused, matching
   * what the dialog's own Cancel / × already do. */
  locked?: boolean;
  /** Stop presses on the backdrop from reaching what is behind it (the editor
   * canvas deselects the current block on a stray click and pans on a drag).
   * The closing press is handled either way; this is about everything else. */
  isolatePointerEvents?: boolean;
  onClose: () => void;
  children: (titleId: string) => React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Modality and focus, on mount and undone on unmount — once, and never again.
  // Tying this to the key handling below would re-run it whenever `onClose`
  // changed identity (callers pass inline arrows, so on every parent render),
  // snatching focus back to the first field every time an edit or an autosave
  // tick re-rendered the page around it.
  //
  // The two live in one effect because their order is the whole trick, and two
  // effects would run their cleanups in the wrong one: `inert` blurs whatever it
  // swallows, so the trigger has to be read *before* the sweep — and on the way
  // out the marks have to come off *before* focus goes back, because an inert
  // element cannot take it.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const release = inertOutside(overlayRef.current);
    const panel = panelRef.current;
    (focusablesIn(panel)[0] ?? panel)?.focus();
    // Runs after React has taken the dialog out of the DOM, so the trigger is
    // focusable again. `isConnected` covers a trigger that a revalidation
    // replaced while the dialog was open — better nothing than an exception.
    return () => {
      release();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;

      if (e.key === "Escape") {
        // An open menu owns Escape: it closes itself and hands focus back to
        // its trigger. This listener is on the capture phase, so without the
        // check it would close the whole dialog before the menu ever saw the
        // key. A locked dialog still swallows it — refusing to close is not the
        // same as letting the page behind act on it.
        if (panel.querySelector('[role="menu"]')) return;
        e.preventDefault();
        e.stopPropagation();
        if (!locked) onClose();
        return;
      }

      if (e.key !== "Tab") return;
      const items = focusablesIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      // Both edges wrap, and focus that has fallen outside the panel — onto
      // <body> after a button disabled itself, say — is pulled back in.
      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [locked, onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4"
      onPointerDown={(e) => {
        if (isolatePointerEvents) e.stopPropagation();
        // Only a press on the backdrop itself — one that started inside the
        // panel and merely ended out here (dragging a selection off the edge of
        // a field) is not someone asking to leave.
        if (e.target !== e.currentTarget) return;
        // Suppress the compatibility mousedown this press would otherwise fire.
        // Its default action is to blur whatever has focus, and it lands *after*
        // React has torn the dialog down — so without this the restore below
        // puts focus back on the trigger and the browser immediately takes it
        // away again, to <body>. Done even when the press is refused, so a
        // locked dialog doesn't quietly lose focus to <body> either.
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={isolatePointerEvents ? (e) => e.stopPropagation() : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={panelClassName}
      >
        {children(titleId)}
      </div>
    </div>
  );
}

const DIALOG = "[role=dialog]";

/**
 * True modality (issue #154): everything outside the dialog is marked `inert`,
 * so a screen reader's virtual cursor can no longer browse the page behind it
 * and a stray press cannot reach it either. The Tab trap above only ever held
 * the keyboard; browse mode walked straight past it.
 *
 * There is no single app root to mark — five of the six dialogs render in place,
 * wherever their trigger happens to live, and the montage one portals to <body>
 * — so this walks from the overlay up to <body> marking every sibling on the
 * way. The dialog's own ancestors are the one chain left alone, which is exactly
 * what keeps the panel itself reachable.
 *
 * Returns the undo. It clears exactly what it marked: anything already inert
 * when the sweep ran — the admin drawer holds <main> that way — is skipped on
 * the way in and so left standing on the way out.
 */
function inertOutside(overlay: HTMLElement | null): () => void {
  if (!overlay) return () => {};
  const root = overlay;
  const marked = new Set<HTMLElement>();

  // The tree under an open dialog does not hold still: the editor autosaves and
  // the members list revalidates after every mutation, so a sibling that mounts
  // later would never be marked — a hole with nothing on screen to show for it.
  // An observer is used rather than a re-sweep on a timer because it closes that
  // hole in the same task as the change, where a timer leaves the new content
  // live until the next tick, and because it costs nothing at all when nothing
  // moves — this audience is on phones.
  //
  // It watches two things. `childList` on each parent is the mounts-while-open
  // case. The `inert` attribute on each marked element is the other direction:
  // React 19 drives `inert` as a prop, and the admin drawer's mobile top bar
  // renders `inert={open}` onto a node this sweep marks — so a render that
  // writes `false` there would quietly clear a mark, and this puts it back.
  // The sweep is handed the observer — from the callback's second argument on a
  // re-run — rather than closing over it: a `const` that names itself in its own
  // initializer sends inference round a cycle it gives up on, typing the whole
  // sweep `any`.
  const observer = new MutationObserver((_records, obs) => sweep(obs));

  function sweep(obs: MutationObserver) {
    for (
      let node: HTMLElement | null = root;
      node && node !== document.body;
      node = node.parentElement
    ) {
      // Pinned to a const before the inner loop: comparing `sibling` against the
      // loop variable itself would make that variable's narrowing depend on
      // `sibling`, which depends on `parent`, which depends on the loop variable
      // — and TypeScript answers a circular inference with `any`.
      const onPath: HTMLElement = node;
      const parent = onPath.parentElement;
      if (!parent) break;
      obs.observe(parent, { childList: true });
      for (const sibling of Array.from(parent.children)) {
        if (sibling === onPath || !(sibling instanceof HTMLElement)) continue;
        // Never inert a subtree holding another open dialog. Nothing stacks two
        // modals today, but if something ever does, the older dialog's observer
        // would fire on the newer one mounting and kill it outright — where
        // skipping merely leaves the older one reachable behind it.
        if (sibling.matches(DIALOG) || sibling.querySelector(DIALOG)) continue;
        // Already inert: someone else's mark, and not this one's to clear.
        if (sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        marked.add(sibling);
        obs.observe(sibling, { attributes: true, attributeFilter: ["inert"] });
      }
    }
  }

  sweep(observer);
  return () => {
    observer.disconnect();
    for (const el of marked) el.removeAttribute("inert");
  };
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Tab order within the panel, in DOM order. The client-rect test drops what is
// present but unreachable — chiefly the hidden <input type="file"> every upload
// control keeps behind its visible button.
function focusablesIn(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}
