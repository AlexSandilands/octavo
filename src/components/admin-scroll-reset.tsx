"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { adminMain } from "./admin-main";

export function AdminScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    // Reset across sections, including history; leave in-page anchors to the router.
    if (!window.location.hash) adminMain()?.scrollTo({ top: 0 });
  }, [pathname]);

  return null;
}
