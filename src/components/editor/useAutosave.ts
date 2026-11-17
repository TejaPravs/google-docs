"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TiptapDoc } from "@/db/schema";

export type SaveStatus =
  | "saved" // everything persisted
  | "dirty" // local changes waiting for the debounce
  | "saving" // request in flight
  | "error" // network/server error, retrying with backoff
  | "conflict" // 409: someone else saved a newer version
  | "lost"; // 403/404: deleted or access removed

type Pending = { content?: TiptapDoc; title?: string };

const DEBOUNCE_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Autosave with optimistic concurrency.
 * - Debounces content edits; title changes save immediately.
 * - Exactly one request in flight; edits made meanwhile are queued and sent next
 *   with the version returned by the previous save.
 * - Network/5xx -> keep the edits and retry with exponential backoff.
 * - 409 -> stop saving and surface a conflict (never overwrite someone else).
 */
export function useAutosave({
  docId,
  initialVersion,
  enabled,
  onTitleSaved,
  onError,
}: {
  docId: string;
  initialVersion: number;
  enabled: boolean;
  onTitleSaved?: (title: string) => void;
  onError?: (message: string) => void;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const version = useRef(initialVersion);
  const pending = useRef<Pending>({});
  const inFlight = useRef(false);
  const stopped = useRef(false); // conflict or lost: never send again
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const backoff = useRef(0);

  const hasPending = () => pending.current.content !== undefined || pending.current.title !== undefined;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!enabled || stopped.current || inFlight.current || !hasPending()) return;

    const payload = pending.current;
    pending.current = {};
    inFlight.current = true;
    setStatus("saving");

    let res: Response | null = null;
    try {
      res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, version: version.current }),
      });
    } catch {
      res = null; // offline / network error
    }
    inFlight.current = false;

    if (res?.ok) {
      const body = (await res.json()) as { version: number; title: string };
      version.current = body.version;
      backoff.current = 0;
      if (payload.title !== undefined) onTitleSaved?.(body.title);
      if (hasPending()) return void flush(); // edits arrived during the save
      setStatus("saved");
      setSavedAt(new Date());
      return;
    }

    if (res && res.status === 409) {
      stopped.current = true;
      pending.current = { ...payload, ...pending.current };
      setStatus("conflict");
      return;
    }
    if (res && (res.status === 403 || res.status === 404)) {
      stopped.current = true;
      setStatus("lost");
      return;
    }
    if (res && res.status === 400) {
      // Validation problem (e.g. document too large): drop this payload, tell the user.
      const body = await res.json().catch(() => null);
      onError?.(body?.error?.message ?? "Couldn't save this change.");
      setStatus(hasPending() ? "dirty" : "saved");
      if (hasPending()) timer.current = setTimeout(flush, DEBOUNCE_MS);
      return;
    }

    // Network error or 5xx: put the payload back (newer edits win) and retry.
    pending.current = { ...payload, ...pending.current };
    setStatus("error");
    backoff.current = Math.min(backoff.current ? backoff.current * 2 : 2000, MAX_BACKOFF_MS);
    timer.current = setTimeout(flush, backoff.current);
  }, [docId, enabled, onTitleSaved, onError]);

  const scheduleContent = useCallback(
    (content: TiptapDoc) => {
      if (!enabled || stopped.current) return;
      pending.current.content = content;
      setStatus((s) => (s === "saving" || s === "error" ? s : "dirty"));
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [enabled, flush],
  );

  const saveTitle = useCallback(
    (title: string) => {
      if (!enabled || stopped.current) return;
      pending.current.title = title;
      void flush();
    },
    [enabled, flush],
  );

  // Warn before closing the tab with unsaved work; best-effort flush when hidden.
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPending() || inFlight.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [enabled, flush]);

  // Leaving the page in-app (e.g. Back to documents): send whatever is pending.
  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      if (enabled && !stopped.current && hasPending()) {
        void fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pending.current, version: version.current }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [docId, enabled]);

  return { status, savedAt, scheduleContent, saveTitle, flushNow: flush };
}
