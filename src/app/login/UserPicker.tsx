"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { api, ApiError } from "@/lib/api-client";

type DemoUser = { id: string; email: string; name: string; avatarColor: string; hint: string };

export function UserPicker({ users, next }: { users: DemoUser[]; next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function signIn(email: string) {
    setPending(email);
    try {
      await api("/api/auth/login", { method: "POST", json: { email } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't sign in.");
      setPending(null);
    }
  }

  return (
    <ul className="divide-y divide-slate-100">
      {users.map((u) => (
        <li key={u.id}>
          <button
            type="button"
            onClick={() => signIn(u.email)}
            disabled={pending !== null}
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60"
          >
            <Avatar name={u.name} color={u.avatarColor} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-slate-900">{u.name}</span>
                <span className="text-sm text-slate-500">{u.email}</span>
              </span>
              <span className="block text-sm text-slate-500">{u.hint}</span>
            </span>
            {pending === u.email ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-label="Signing in" />
            ) : (
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" aria-hidden />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
