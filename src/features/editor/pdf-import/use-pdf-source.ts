"use client";

import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
import { PdfSource } from "./adapter";
import type { SourcePage } from "./model";
import { splitPageRegions } from "./split";

// What the panel shows for a failure: the importer's own messages are written
// for the author; anything else (a validation error, a library throw) is not.
const reason = (err: unknown, fallback: string) =>
  err instanceof Error && !(err instanceof ZodError) && err.message
    ? err.message
    : fallback;

// One open PDF in the panel: opening a file, reading its pages on demand and
// releasing everything on close. Every asynchronous result is checked against
// a generation counter so a replaced or closed file can't land stale state.
export function usePdfSource() {
  const source = useRef<PdfSource | null>(null);
  const operation = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [name, setName] = useState("");
  const [page, setPage] = useState<SourcePage | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const release = () => {
    generation.current++;
    operation.current?.abort();
    source.current?.dispose();
    source.current = null;
  };
  useEffect(() => release, []);

  const close = () => {
    release();
    setName("");
    setPage(null);
    setPageCount(0);
    setPageNumber(1);
    setBusy(false);
    setError("");
  };

  const open = async (file: File) => {
    close();
    const gen = generation.current;
    const controller = new AbortController();
    operation.current = controller;
    const next = new PdfSource();
    source.current = next;
    setName(file.name);
    setBusy(true);
    try {
      await next.open(file, controller.signal);
      const first = await next.page(1, controller.signal);
      if (gen !== generation.current) return;
      setPageCount(next.pageCount);
      setPageNumber(1);
      setPage(first);
    } catch (err) {
      if (gen !== generation.current) return;
      next.dispose();
      source.current = null;
      setName("");
      setError(reason(err, "Could not open PDF."));
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  };

  const navigate = async (number: number) => {
    if (!source.current || busy || number < 1 || number > pageCount) return;
    const gen = generation.current;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError("");
    setPageNumber(number);
    setPage(null);
    try {
      const next = await source.current.page(number, controller.signal);
      if (gen === generation.current) setPage(next);
    } catch (err) {
      if (gen === generation.current)
        setError(reason(err, "Could not read this page."));
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  };

  const split = (regionId: string) => {
    if (!page || !source.current) return;
    const regions = splitPageRegions(page.regions, regionId);
    if (regions === page.regions) return;
    source.current.setRegions(page.number, regions);
    setPage({ ...page, regions });
  };

  return {
    name,
    page,
    pageCount,
    pageNumber,
    busy,
    error,
    loaded: pageCount > 0,
    open,
    navigate,
    close,
    cancel: () => operation.current?.abort(),
    split,
  };
}
