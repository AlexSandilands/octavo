"use client";

import { useRef, useState, type DragEvent } from "react";

const hasFiles = (e: DragEvent) =>
  Array.from(e.dataTransfer.types).includes("Files");

// Drag-and-drop of one file onto a region. Enter/leave are counted because the
// browser fires them for every child the pointer crosses; the highlight would
// flicker otherwise. What the file is gets checked by whoever opens it.
export function useFileDrop(onFile: (file: File) => void, enabled = true) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const reset = () => {
    depth.current = 0;
    setOver(false);
  };
  return {
    over: enabled && over,
    handlers: {
      onDragEnter: (e: DragEvent) => {
        if (!enabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      },
      onDragOver: (e: DragEvent) => {
        if (!enabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: () => {
        if (--depth.current <= 0) reset();
      },
      onDrop: (e: DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        reset();
        const file = e.dataTransfer.files[0];
        if (enabled && file) onFile(file);
      },
    },
  };
}
