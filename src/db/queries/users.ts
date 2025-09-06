import { db } from '../index.js';
import { users } from '../schema.js';
import type { NewUser } from '../schema.js';

export async function createUser(user: NewUser) {
	const [result] = await db
		.insert(users)
		.values(user)
		.onConflictDoNothing()
		.returning();
	return result;
}

export async function deleteAll() {
	return await db.delete(users);
}