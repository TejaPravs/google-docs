"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Looks like a heading; edits inline. Enter/blur saves, Esc reverts. */
export function TitleInput({
  title,
  editable,
  onSave,
}: {
  title: string;
  editable: boolean;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);

  if (!editable) {
    return <h1 className="min-w-0 truncate text-lg font-medium text-slate-900">{title}</h1>;
  }

  const commit = () => {
    const next = value.trim();
    if (!next) {
      toast.error("Title can't be empty.");
      setValue(title);
      return;
    }
    if (next !== title) onSave(next);
    setValue(next);
  };

  return (
    <input
      aria-label="Document title"
      value={value}
      maxLength={200}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setValue(title);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-medium text-slate-900 hover:border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
    />
  );
}
