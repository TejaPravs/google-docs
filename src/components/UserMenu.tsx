"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, LogOut, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

type Props = { name: string; email: string; avatarColor?: string };

/**
 * Account menu: "Switch user" and "Log out". Both end the session server-side
 * (clears the httpOnly cookie) and then do a full page load, so no signed-in
 * page or cached data from the previous user survives in the browser.
 */
export function UserMenu({ name, email, avatarColor }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"switch" | "logout" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut(kind: "switch" | "logout") {
    setPending(kind);
    // Logout never touches the database, so it works even when Neon is unreachable.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign(kind === "logout" ? "/login?signedOut=1" : "/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-medium leading-tight text-slate-900">{name}</span>
          <span className="block text-xs leading-tight text-slate-500">{email}</span>
        </span>
        <Avatar name={name} color={avatarColor} />
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
            <div className="text-sm font-medium text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{email}</div>
          </div>
          <MenuItem
            icon={pending === "switch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            label="Switch user"
            hint="Sign in as Alice, Bob or Carol"
            disabled={pending !== null}
            onClick={() => signOut("switch")}
          />
          <MenuItem
            icon={pending === "logout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            label="Log out"
            disabled={pending !== null}
            onClick={() => signOut("logout")}
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  disabled,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={
        "flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:opacity-60 " +
        (danger ? "text-red-600" : "text-slate-700")
      }
    >
      <span className="mt-0.5" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}
