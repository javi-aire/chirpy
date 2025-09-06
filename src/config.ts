process.loadEnvFile()
import type { MigrationConfig } from 'drizzle-orm/migrator';

type APIConfig = {
	fileServerHits: number;
	db: DBConfig;
	platform: string;
}

type DBConfig = {
	url: string;
	migrationConfig: {
		migrationsFolder: string;
	}
}

const migrationConfig: MigrationConfig = {
	migrationsFolder: './src/db/migrations',
};

//400
export class BadRequestError extends Error {
	constructor(message: string) {
		super(message);
	}
}

//401
export class UnauthorizedError extends Error {
	constructor(message: string) {
		super(message);
	}
}

//403
export class ForbiddenError extends Error {
	constructor(message: string) {
		super(message);
	}
}

//404
export class NotFoundError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export const config: APIConfig = {
	fileServerHits: 0,
	platform: 'dev',
	db: {
		url: `${process.env.DB_URL}`,
		migrationConfig
	}
}