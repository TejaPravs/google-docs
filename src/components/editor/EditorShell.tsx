"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { ArrowLeft, Eye, OctagonX, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { AccessRole, TiptapDoc } from "@/db/schema";
import { baseExtensions } from "@/lib/editor-extensions";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { DeleteDocButton } from "@/components/docs/DeleteDocButton";
import { ShareButton } from "@/components/share/ShareDialog";
import { Toolbar } from "./Toolbar";
import { TitleInput } from "./TitleInput";
import { SaveStatus } from "./SaveStatus";
import { useAutosave } from "./useAutosave";

export type EditorDoc = {
  id: string;
  title: string;
  content: TiptapDoc;
  version: number;
  shareCount: number;
};

export function EditorShell({
  doc,
  role,
  owner,
}: {
  doc: EditorDoc;
  role: AccessRole;
  owner: { name: string; email: string };
}) {
  const canEdit = role === "owner" || role === "editor";
  const [title, setTitle] = useState(doc.title);
  const [shareCount, setShareCount] = useState(doc.shareCount);

  const onError = useCallback((m: string) => toast.error(m), []);
  const autosave = useAutosave({
    docId: doc.id,
    initialVersion: doc.version,
    enabled: canEdit,
    onTitleSaved: setTitle,
    onError,
  });

  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      Placeholder.configure({ placeholder: canEdit ? "Start writing…" : "This document is empty." }),
    ],
    content: doc.content as JSONContent, // shape validated server-side (zod + schema)
    editable: canEdit,
    immediatelyRender: false, // avoid SSR hydration mismatch
    autofocus: canEdit && isEmpty(doc.content) ? "start" : false,
    editorProps: {
      attributes: {
        class: "tiptap-doc focus:outline-none",
        "aria-label": "Document body",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => autosave.scheduleContent(editor.getJSON() as TiptapDoc),
  });

  // Ctrl/Cmd+S saves now instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void autosave.flushNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autosave]);

  // Stop editing once we know the save can't land.
  useEffect(() => {
    if (editor && (autosave.status === "conflict" || autosave.status === "lost")) editor.setEditable(false);
  }, [editor, autosave.status]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-2 px-3">
          <Link
            href="/docs"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Back to documents"
            title="Back to documents"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <TitleInput title={title} editable={canEdit} onSave={(t) => { setTitle(t); autosave.saveTitle(t); }} />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {canEdit && <SaveStatus status={autosave.status} savedAt={autosave.savedAt} />}
            {role !== "owner" && (
              <span className="hidden text-xs text-slate-500 md:inline">Owned by {owner.name}</span>
            )}
            <RoleBadge role={role} />
            <ShareButton docId={doc.id} title={title} isOwner={role === "owner"} onCountChange={setShareCount} />
            {role === "owner" && (
              <DeleteDocButton id={doc.id} title={title} shareCount={shareCount} redirectTo="/docs" />
            )}
          </div>
        </div>
        {canEdit && editor && autosave.status !== "conflict" && autosave.status !== "lost" && (
          <div className="border-t border-slate-100">
            <Toolbar editor={editor} />
          </div>
        )}
      </header>

      {role === "viewer" && (
        <Banner tone="amber" icon={<Eye className="h-4 w-4" />}>
          View only — ask {owner.name} for edit access.
        </Banner>
      )}
      {autosave.status === "conflict" && (
        <Banner tone="red" icon={<OctagonX className="h-4 w-4" />}>
          This document was changed somewhere else, so your latest edits weren&apos;t saved.
          <span className="ml-2 inline-flex gap-2">
            <button
              type="button"
              className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-red-50"
              onClick={async () => {
                await navigator.clipboard.writeText(editor?.getText() ?? "");
                toast.success("Your text was copied to the clipboard.");
              }}
            >
              Copy my text
            </button>
            <button
              type="button"
              className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700"
              onClick={() => window.location.reload()}
            >
              Reload latest
            </button>
          </span>
        </Banner>
      )}
      {autosave.status === "lost" && (
        <Banner tone="red" icon={<ShieldAlert className="h-4 w-4" />}>
          Your access to this document changed, or it was deleted. Your latest edits weren&apos;t saved.{" "}
          <Link href="/docs" className="font-medium underline">
            Back to documents
          </Link>
        </Banner>
      )}

      <main className="flex-1 px-3 py-6 sm:px-6 sm:py-10">
        <div
          className="mx-auto min-h-[70vh] w-full max-w-[816px] cursor-text rounded-lg border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-16 sm:py-14"
          onClick={() => editor?.isEditable && !editor.isFocused && editor.commands.focus("end")}
        >
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="space-y-3" aria-hidden>
              <div className="h-7 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={
        "flex items-center gap-2 border-b px-4 py-2 text-sm " +
        (tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-red-200 bg-red-50 text-red-800")
      }
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function isEmpty(doc: TiptapDoc) {
  const c = doc.content as { content?: unknown[] }[] | undefined;
  return !c || c.length === 0 || (c.length === 1 && !c[0].content?.length);
}
