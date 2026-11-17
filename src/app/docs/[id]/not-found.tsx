import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function DocNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <FileQuestion className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Document not found</h1>
        <p className="mt-1 text-sm text-slate-500">
          It may have been deleted, or you don&apos;t have access to it.
        </p>
        <Link
          href="/docs"
          className="mt-5 inline-flex rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Back to documents
        </Link>
      </div>
    </main>
  );
}
