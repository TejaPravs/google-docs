"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteDocButton({
  id,
  title,
  shareCount,
  redirectTo,
  className,
}: {
  id: string;
  title: string;
  shareCount: number;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      toast.success(`Deleted “${title}”`);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete the document.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${title}`}
        title="Delete"
        className={
          "rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600 " +
          (className ?? "")
        }
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete “${title}”?`}
        description={
          <>
            {shareCount > 0
              ? `It will also be removed for the ${shareCount} ${shareCount === 1 ? "person" : "people"} it's shared with. `
              : ""}
            This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={onConfirm}
        onClose={() => !pending && setOpen(false)}
      />
    </>
  );
}
