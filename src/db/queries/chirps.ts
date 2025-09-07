import { db } from '../index.js';
import { chirps } from '../schema.js';
import type { NewChirp } from '../schema.js';
import { asc, eq } from 'drizzle-orm';

export async function createChirp(chirp: NewChirp) {
	const [result] = await db
		.insert(chirps)
		.values(chirp)
		.onConflictDoNothing()
		.returning();
	return result;
}

export async function getAllChirps() {
	const result = await db
		.select()
		.from(chirps)
		.orderBy(asc(chirps.createdAt));
	return result;
}

export async function getChirp(id: string) {
	const [result] = await db
		.select()
		.from(chirps)
		.where(eq(chirps.id, id));
	return result;
}