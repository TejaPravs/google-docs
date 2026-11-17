import { AppError, handler } from "@/lib/errors";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import { findUserByEmail } from "@/services/users";

/** POST /api/auth/login {email} — mocked auth: sign in as a seeded user. */
export const POST = handler(async (req) => {
  const { email } = loginSchema.parse(await req.json());
  const user = await findUserByEmail(email);
  if (!user) throw new AppError("USER_NOT_FOUND", 404, "No demo user with that email.");
  await createSession({ id: user.id, email: user.email, name: user.name });
  return Response.json({ user });
});
