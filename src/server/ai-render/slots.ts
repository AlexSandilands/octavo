import "server-only";

// At most this many page renders at once (#342): each holds a headless
// Chromium, and the app runs as one instance. The rest are turned away (503)
// rather than queued, and the editor carries on without the picture.
export const AI_RENDER_SLOTS = 2;

let busy = 0;

/** A slot to render in, and its release; null when every slot is taken. */
export function takeRenderSlot(): (() => void) | null {
  if (busy >= AI_RENDER_SLOTS) return null;
  busy++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    busy--;
  };
}
