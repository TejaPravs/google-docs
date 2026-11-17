"use client";

import { AlertTriangle, Check, CloudOff, Loader2, OctagonX } from "lucide-react";
import type { SaveStatus as Status } from "./useAutosave";

export function SaveStatus({ status, savedAt }: { status: Status; savedAt: Date | null }) {
  return (
    <span aria-live="polite" className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      {status === "saved" && (
        <span className="inline-flex items-center gap-1 text-slate-500">
          <Check className="h-3.5 w-3.5 text-green-600" aria-hidden />
          Saved
          {savedAt && (
            <span className="hidden sm:inline">
              {" "}
              · {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </span>
      )}
      {(status === "dirty" || status === "saving") && (
        <span className="inline-flex items-center gap-1 text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Saving…
        </span>
      )}
      {status === "error" && (
        <span className="inline-flex items-center gap-1 text-amber-600">
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
          Offline — retrying
        </span>
      )}
      {status === "conflict" && (
        <span className="inline-flex items-center gap-1 text-red-600">
          <OctagonX className="h-3.5 w-3.5" aria-hidden />
          Out of date
        </span>
      )}
      {status === "lost" && (
        <span className="inline-flex items-center gap-1 text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Not saved
        </span>
      )}
    </span>
  );
}
