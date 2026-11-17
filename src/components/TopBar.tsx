import Link from "next/link";
import { FileText } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import type { SessionUser } from "@/lib/session";

export function TopBar({ user, avatarColor }: { user: SessionUser; avatarColor?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/docs" className="flex items-center gap-2 font-semibold text-slate-900">
          <FileText className="h-5 w-5 text-indigo-600" aria-hidden />
          Ajaia Docs
        </Link>
        <UserMenu name={user.name} email={user.email} avatarColor={avatarColor} />
      </div>
    </header>
  );
}
