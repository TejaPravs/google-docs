import type { AccessRole } from "@/db/schema";
import { cn } from "@/lib/cn";

const STYLES: Record<AccessRole, string> = {
  owner: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  editor: "bg-green-50 text-green-700 ring-green-200",
  viewer: "bg-slate-100 text-slate-700 ring-slate-200",
};
const LABELS: Record<AccessRole, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

export function RoleBadge({ role, className }: { role: AccessRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[role],
        className,
      )}
    >
      {LABELS[role]}
    </span>
  );
}
