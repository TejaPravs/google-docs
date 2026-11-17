"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** App-wide error boundary: shown instead of a blank page when a server render fails. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-1 text-sm text-slate-500">
          We couldn&apos;t load this page. It&apos;s usually a temporary connection problem.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
          <Link
            href="/docs"
            className="rounded-md px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to documents
          </Link>
        </div>
      </div>
    </main>
  );
}
