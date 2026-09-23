"use client";

import { useEffect, useState } from "react";

// The part of the screen the on-screen keyboard leaves visible, so the sheet
// can sit above it (issue #301). Falls back to the window where the API is
// missing.
export function useVisualViewport() {
  const [box, setBox] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox(read());
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return box;
}

function read() {
  const vv = window.visualViewport;
  return {
    top: vv?.offsetTop ?? 0,
    height: vv?.height ?? window.innerHeight,
  };
}
