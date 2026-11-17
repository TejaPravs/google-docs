import { redirect } from "next/navigation";
import { FilePlus2, Inbox } from "lucide-react";
import { getSession } from "@/lib/session";
import { listForUser } from "@/services/documents";
import { TopBar } from "@/components/TopBar";
import { DocCard } from "@/components/docs/DocCard";
import { NewDocButton } from "@/components/docs/NewDocButton";
import { KeepFresh } from "@/components/docs/KeepFresh";
import { ImportButton } from "@/components/docs/ImportButton";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const { owned, shared } = await listForUser(user.id);

  return (
    <>
      <KeepFresh renderedAt={Date.now()} />
      <TopBar user={user} avatarColor={user.avatarColor} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <NewDocButton />
          <ImportButton />
        </div>

        <section aria-labelledby="owned-heading" className="mt-8">
          <h2 id="owned-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            My documents <span className="font-normal">({owned.length})</span>
          </h2>
          {owned.length === 0 ? (
            <EmptyState
              icon={<FilePlus2 className="h-6 w-6" aria-hidden />}
              title="No documents yet"
              body="Create a document, or import a .txt, .md or .docx file."
            />
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {owned.map((d) => (
                <li key={d.id} className="flex">
                  <div className="flex-1">
                    <DocCard kind="owned" doc={d} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="shared-heading" className="mt-10">
          <h2 id="shared-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Shared with me <span className="font-normal">({shared.length})</span>
          </h2>
          {shared.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" aria-hidden />}
              title="Nothing shared with you yet"
              body="When someone shares a document with you, it appears here."
            />
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shared.map((d) => (
                <li key={d.id} className="flex">
                  <div className="flex-1">
                    <DocCard kind="shared" doc={d} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mt-3 flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <div className="text-slate-400">{icon}</div>
      <p className="mt-2 font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}
