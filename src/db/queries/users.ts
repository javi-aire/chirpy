import { db } from '../index.js';
import { users } from '../schema.js';
import { hashPassword } from '../auth.js';
import type { NewUser } from '../schema.js';
import { eq } from 'drizzle-orm';

export type UserResponse = Omit<NewUser, "hashedPassword">;

type NewUserParam = {
	email: string;
	password: string;
}

export async function createUser(user: NewUserParam) {
	const { email, password } = user;
	const hashedPassword = await hashPassword(password);
	const [result]: UserResponse[] = await db
		.insert(users)
		.values({ email, hashedPassword })
		.onConflictDoNothing()
		.returning();
	return result;
}

export async function deleteAll() {
	return await db.delete(users);
}

export async function getUser(email: string) {
	const [result] = await db
		.select()
		.from(users)
		.where(eq(users.email, email));
	return result;
}