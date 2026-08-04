import { useEffect, useLayoutEffect } from "react";

// An effect that runs before the browser paints, for the two things on this
// page that must be settled by the first client frame: restoring the remembered
// split, and measuring the preview column it decides the width of. Run as
// ordinary effects, both land after a paint has gone out, and the layout is
// seen to jump from the default to the stored one.
//
// It is `useLayoutEffect` in the browser and `useEffect` on the server, where
// there is no layout to read and React warns about the layout variant. This
// does not (and cannot) do anything about the *server's* paint: the SSR markup
// is rendered without knowing the viewport, so the first frame of all is still
// the default. Only moving the sizing into CSS closes that one.
export const usePrePaintEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
