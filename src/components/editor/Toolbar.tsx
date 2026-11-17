"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { Bold, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

type BlockType = "paragraph" | "h1" | "h2" | "h3";

export function Toolbar({ editor }: { editor: Editor }) {
  // Re-render only when the bits the toolbar shows actually change.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      block: (e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "paragraph") as BlockType,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setBlock = (b: BlockType) => {
    const chain = editor.chain().focus();
    if (b === "paragraph") chain.setParagraph().run();
    else chain.setHeading({ level: Number(b[1]) as 1 | 2 | 3 }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex items-center gap-1 overflow-x-auto px-3 py-1.5"
    >
      <Btn label={`Undo (${MOD}Z)`} onClick={() => editor.chain().focus().undo().run()} disabled={!s.canUndo}>
        <Undo2 className="h-4 w-4" />
      </Btn>
      <Btn
        label={`Redo (${MOD}Shift+Z)`}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!s.canRedo}
      >
        <Redo2 className="h-4 w-4" />
      </Btn>
      <Sep />
      <label className="sr-only" htmlFor="block-type">
        Text style
      </label>
      <select
        id="block-type"
        value={s.block}
        onChange={(e) => setBlock(e.target.value as BlockType)}
        className="h-8 rounded-md border border-transparent bg-transparent px-2 text-sm text-slate-700 hover:bg-slate-100 focus-visible:border-indigo-500 focus-visible:outline-none"
      >
        <option value="paragraph">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Sep />
      <Btn label={`Bold (${MOD}B)`} active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn label={`Italic (${MOD}I)`} active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn
        label={`Underline (${MOD}U)`}
        active={s.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </Btn>
      <Sep />
      <Btn
        label={`Bulleted list (${MOD}Shift+8)`}
        active={s.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Btn>
      <Btn
        label={`Numbered list (${MOD}Shift+7)`}
        active={s.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Btn>
    </div>
  );
}

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;
}
