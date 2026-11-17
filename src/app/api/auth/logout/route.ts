import { handler } from "@/lib/errors";
import { clearSession } from "@/lib/session";

/** POST /api/auth/logout — clears the session cookie. */
export const POST = handler(async () => {
  clearSession();
  return new Response(null, { status: 204 });
});
