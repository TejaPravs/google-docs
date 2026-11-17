import { CheckCircle2, CloudOff, FileText, Info } from "lucide-react";
import { listUsers } from "@/services/users";
import { UserPicker } from "./UserPicker";

export const dynamic = "force-dynamic";

const HINTS: Record<string, string> = {
  "alice@ajaia.dev": "Owns the sample docs and shares them",
  "bob@ajaia.dev": "Can edit “Q4 Planning”",
  "carol@ajaia.dev": "Can only view “Q4 Planning”",
};

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/docs") && !next.startsWith("//") ? next : "/docs";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; signedOut?: string };
}) {
  // Don't crash the sign-in page if the database is briefly unreachable.
  const users = await listUsers().catch((err) => {
    console.error("[login] could not load users", err);
    return null;
  });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <FileText className="h-7 w-7 text-indigo-600" aria-hidden />
            Ajaia Docs
          </div>
          <p className="mt-2 text-slate-500">Lightweight docs for shared work</p>
        </div>

        {searchParams.signedOut && (
          <p
            role="status"
            className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            You&apos;ve been logged out.
          </p>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <h1 className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            Sign in as a demo user
          </h1>
          {users === null ? (
            <div className="px-4 py-6 text-sm text-slate-600">
              <p className="flex items-center gap-2 font-medium text-amber-700">
                <CloudOff className="h-4 w-4" aria-hidden />
                Can&apos;t reach the database right now.
              </p>
              <p className="mt-1 text-slate-500">This is usually a brief network issue.</p>
              <a
                href={searchParams.next ? `/login?next=${encodeURIComponent(safeNext(searchParams.next))}` : "/login"}
                className="mt-3 inline-flex rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Try again
              </a>
            </div>
          ) : users.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No demo users found. Run <code className="rounded bg-slate-100 px-1">npm run db:seed</code>.
            </p>
          ) : (
            <UserPicker
              users={users.map((u) => ({ ...u, hint: HINTS[u.email] ?? "" }))}
              next={safeNext(searchParams.next)}
            />
          )}
        </section>

        <p className="mt-4 flex gap-2 text-sm text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Demo auth: no passwords. To test sharing, sign in as a second user in a private window or
            another browser.
          </span>
        </p>
      </div>
    </main>
  );
}
