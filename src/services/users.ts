import { asc, eq } from "drizzle-orm";
import { getDb, type DB } from "@/db/client";
import { users, type User } from "@/db/schema";

export type PublicUser = Pick<User, "id" | "email" | "name" | "avatarColor">;

const publicCols = {
  id: users.id,
  email: users.email,
  name: users.name,
  avatarColor: users.avatarColor,
};

export async function listUsers(db: DB = getDb()): Promise<PublicUser[]> {
  return db.select(publicCols).from(users).orderBy(asc(users.name));
}

export async function findUserByEmail(email: string, db: DB = getDb()): Promise<PublicUser | null> {
  const [row] = await db
    .select(publicCols)
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}
