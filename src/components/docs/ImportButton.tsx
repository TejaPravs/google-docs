"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

// Keep in sync with src/lib/import (server is the source of truth; this is for fast feedback).
const ACCEPT = ".txt,.md,.markdown,.docx";
const ALLOWED = [".txt", ".md", ".markdown", ".docx"];
const MAX_BYTES = 2 * 1024 * 1024;

export function ImportButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function onFile(file: File) {
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    if (!ALLOWED.includes(ext)) {
      toast.error(`Can't import “${file.name}”. Supported types: .txt, .md, .docx.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`);
      return;
    }
    if (file.size === 0) {
      toast.error(`“${file.name}” is empty.`);
      return;
    }

    setPending(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/documents/import", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Import failed. Please try again.");
      toast.success(`Imported “${file.name}”`, {
        description: json.notes?.length ? json.notes.join(" ") : undefined,
      });
      router.push(`/docs/${json.id}`);
    } catch (err) {
      toast.error(
        err instanceof TypeError ? "You appear to be offline. Check your connection." : (err as Error).message,
      );
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // allow re-selecting the same file
          if (f) void onFile(f);
        }}
      />
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
        {pending ? `Importing ${pending}…` : "Import file"}
      </button>
      <span className="text-xs text-slate-500">.txt, .md or .docx · max 2 MB · becomes a new document</span>
    </div>
  );
}
