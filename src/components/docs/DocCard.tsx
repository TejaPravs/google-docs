import Link from "next/link";
import { FileText, Users } from "lucide-react";
import type { OwnedDocSummary, SharedDocSummary } from "@/services/documents";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { Avatar } from "@/components/ui/Avatar";
import { DeleteDocButton } from "./DeleteDocButton";
import { timeAgo } from "@/lib/time";

type Props =
  | { kind: "owned"; doc: OwnedDocSummary }
  | { kind: "shared"; doc: SharedDocSummary };

export function DocCard(props: Props) {
  const { doc } = props;
  return (
    <article className="group relative flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-500">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
        <h3 className="line-clamp-2 min-w-0 flex-1 font-medium text-slate-900">
          {/* Stretched link: the whole card is clickable without nesting buttons in <a>. */}
          <Link href={`/docs/${doc.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {doc.title}
          </Link>
        </h3>
      </div>

      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">
        {doc.preview || <span className="italic text-slate-400">Empty document</span>}
      </p>

      {props.kind === "shared" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
          <Avatar name={props.doc.owner.name} color={props.doc.owner.avatarColor} size="sm" />
          from {props.doc.owner.name}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">Edited {timeAgo(doc.updatedAt)}</span>
        <div className="flex items-center gap-2">
          {props.kind === "owned" && props.doc.shareCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs text-slate-500"
              title={`Shared with ${props.doc.shareCount}`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Shared with</span>
              {props.doc.shareCount}
            </span>
          )}
          <RoleBadge role={props.kind === "owned" ? "owner" : props.doc.role} />
          {props.kind === "owned" && (
            <DeleteDocButton
              id={doc.id}
              title={doc.title}
              shareCount={props.doc.shareCount}
              className="relative z-10"
            />
          )}
        </div>
      </div>
    </article>
  );
}
