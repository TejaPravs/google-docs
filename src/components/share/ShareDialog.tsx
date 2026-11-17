"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, UserMinus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/RoleBadge";
import type { ShareRole } from "@/db/schema";

type PublicUser = { id: string; email: string; name: string; avatarColor: string };
type ShareEntry = { user: PublicUser; role: ShareRole };
type ShareList = { owner: PublicUser; shares: ShareEntry[] };

export function ShareButton({
  docId,
  title,
  isOwner,
  onCountChange,
}: {
  docId: string;
  title: string;
  isOwner: boolean;
  onCountChange?: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {isOwner ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Share"
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Users className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline" aria-hidden>
            Share
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="People with access"
          aria-label="People with access"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <Users className="h-4 w-4" aria-hidden />
        </button>
      )}
      {open && (
        <ShareDialog
          docId={docId}
          title={title}
          isOwner={isOwner}
          onClose={() => setOpen(false)}
          onCountChange={onCountChange}
        />
      )}
    </>
  );
}

function ShareDialog({
  docId,
  title,
  isOwner,
  onClose,
  onCountChange,
}: {
  docId: string;
  title: string;
  isOwner: boolean;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [list, setList] = useState<ShareList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PublicUser[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const updateList = useCallback(
    (next: ShareList) => {
      setList(next);
      onCountChange?.(next.shares.length);
    },
    [onCountChange],
  );

  useEffect(() => {
    api<ShareList>(`/api/documents/${docId}/shares`)
      .then(updateList)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Couldn't load sharing settings."));
    if (isOwner) api<PublicUser[]>("/api/users").then(setSuggestions).catch(() => {});
  }, [docId, isOwner, updateList]);

  const sharedIds = new Set(list?.shares.map((s) => s.user.id));
  const available = suggestions.filter((u) => !sharedIds.has(u.id) && u.id !== list?.owner.id);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!list) return;
    setFormError(null);
    const value = email.trim().toLowerCase();
    if (!value) return setFormError("Enter an email address.");
    setSubmitting(true);
    try {
      const res = await api<ShareEntry & { created: boolean }>(`/api/documents/${docId}/shares`, {
        method: "POST",
        json: { email: value, role },
      });
      const others = list.shares.filter((s) => s.user.id !== res.user.id);
      updateList({ ...list, shares: [...others, { user: res.user, role: res.role }] });
      toast.success(
        res.created
          ? `Shared with ${res.user.name} as ${label(res.role)}`
          : `${res.user.name} is now ${article(res.role)} ${label(res.role)}`,
      );
      setEmail("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't share the document.");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(entry: ShareEntry, next: ShareRole) {
    if (!list || next === entry.role) return;
    const prev = list;
    updateList({ ...list, shares: list.shares.map((s) => (s.user.id === entry.user.id ? { ...s, role: next } : s)) });
    setBusyUser(entry.user.id);
    try {
      await api(`/api/documents/${docId}/shares`, { method: "POST", json: { email: entry.user.email, role: next } });
      toast.success(`${entry.user.name} is now ${article(next)} ${label(next)}`);
    } catch (err) {
      updateList(prev); // roll back
      toast.error(err instanceof ApiError ? err.message : "Couldn't change the role.");
    } finally {
      setBusyUser(null);
    }
  }

  async function remove(entry: ShareEntry) {
    if (!list) return;
    const prev = list;
    updateList({ ...list, shares: list.shares.filter((s) => s.user.id !== entry.user.id) });
    setBusyUser(entry.user.id);
    try {
      await api(`/api/documents/${docId}/shares/${entry.user.id}`, { method: "DELETE" });
      toast.success(`Removed ${entry.user.name}'s access`);
    } catch (err) {
      updateList(prev);
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove access.");
    } finally {
      setBusyUser(null);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="share-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <h2 id="share-title" className="min-w-0 truncate text-base font-semibold text-slate-900">
          {isOwner ? "Share" : "People with access to"} “{title}”
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isOwner && (
        <form onSubmit={onSubmit} className="border-b border-slate-100 px-5 py-4" noValidate>
          <label htmlFor="share-email" className="text-sm font-medium text-slate-700">
            Add people
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="share-email"
              type="email"
              list="share-suggestions"
              autoComplete="off"
              placeholder="name@ajaia.dev"
              value={email}
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                setFormError(null);
              }}
              aria-invalid={!!formError}
              aria-describedby={formError ? "share-error" : undefined}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 aria-[invalid=true]:border-red-400"
            />
            <datalist id="share-suggestions">
              {available.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.name}
                </option>
              ))}
            </datalist>
            <div className="flex gap-2">
              <label htmlFor="share-role" className="sr-only">
                Role
              </label>
              <select
                id="share-role"
                value={role}
                onChange={(e) => setRole(e.target.value as ShareRole)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={submitting || !list}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Share
              </button>
            </div>
          </div>
          {formError && (
            <p id="share-error" role="alert" className="mt-1.5 text-sm text-red-600">
              {formError}
            </p>
          )}
          {available.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              Suggestions:
              {available.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setFormError(null);
                  }}
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {u.name}
                </button>
              ))}
            </p>
          )}
        </form>
      )}

      <div className="px-5 py-4">
        <h3 className="text-sm font-medium text-slate-700">People with access</h3>
        {loadError ? (
          <p className="mt-3 text-sm text-red-600">{loadError}</p>
        ) : !list ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            <Row user={list.owner}>
              <RoleBadge role="owner" />
            </Row>
            {list.shares.map((s) => (
              <Row key={s.user.id} user={s.user}>
                {isOwner ? (
                  <div className="flex items-center gap-1">
                    <label htmlFor={`role-${s.user.id}`} className="sr-only">
                      Role for {s.user.name}
                    </label>
                    <select
                      id={`role-${s.user.id}`}
                      value={s.role}
                      disabled={busyUser === s.user.id}
                      onChange={(e) => changeRole(s, e.target.value as ShareRole)}
                      className="rounded-md border border-transparent px-1.5 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      disabled={busyUser === s.user.id}
                      aria-label={`Remove ${s.user.name}`}
                      title="Remove access"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <RoleBadge role={s.role} />
                )}
              </Row>
            ))}
            {list.shares.length === 0 && (
              <li className="py-3 text-sm text-slate-500">Not shared with anyone yet.</li>
            )}
          </ul>
        )}
      </div>

      <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        Editors can edit and rename. Viewers can only read. Only the owner can share or delete.
      </p>
    </dialog>
  );
}

function Row({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={user.name} color={user.avatarColor} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
        <div className="truncate text-xs text-slate-500">{user.email}</div>
      </div>
      {children}
    </li>
  );
}

const label = (r: ShareRole) => (r === "editor" ? "Editor" : "Viewer");
const article = (r: ShareRole) => (r === "editor" ? "an" : "a");
