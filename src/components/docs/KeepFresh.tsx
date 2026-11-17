"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a server-rendered list current:
 * - Browser back/forward restores Next's cached snapshot of the page (staleTimes
 *   doesn't apply to history navigation). If the snapshot is older than a couple
 *   of seconds, refetch it.
 * - When the tab regains focus (e.g. a doc was renamed in another tab or by a
 *   collaborator), refetch too.
 */
export function KeepFresh({ renderedAt, maxAgeMs = 2000 }: { renderedAt: number; maxAgeMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (Date.now() - renderedAt > maxAgeMs) router.refresh();
  }, [renderedAt, maxAgeMs, router]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
