import "server-only";
import { cookies } from "next/headers";
import { unauthorized } from "./errors";
import { findUserByEmail } from "@/services/users";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
  type SessionUser,
} from "./session-token";

/**
 * Mocked auth: a signed (HS256) JWT in an httpOnly cookie identifies one of the
 * seeded users. This module is the single seam to swap in real auth later.
 */
export type { SessionUser };

export async function createSession(user: SessionUser): Promise<void> {
  cookies().set(SESSION_COOKIE, await signSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}

export type CurrentUser = SessionUser & { avatarColor: string };

/**
 * Verifies the cookie, then resolves the user from the DB by email. The DB row
 * is authoritative: if the user was removed or re-seeded (new id), a stale
 * cookie can't act with an old id — it resolves to the current row or to null.
 */
export async function getSession(): Promise<CurrentUser | null> {
  const token = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const user = await findUserByEmail(token.email);
  return user ? { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor } : null;
}

/** For route handlers: returns the user or throws a 401 AppError. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getSession();
  if (!user) throw unauthorized();
  return user;
}
