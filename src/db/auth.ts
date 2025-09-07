import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import type { Request } from 'express';
import { UnauthorizedError, NotFoundError } from '../config.js';

type Payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;
const TOKEN_ISSUER = 'chirpy';
export function hashPassword(password: string): Promise<string> {
	const salt = 10;
	const hashed = bcrypt.hash(password, salt);

	return hashed;
}

export function checkPasswordHash(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export function makeJwt(userId: string, expiresIn: number, secret: string): string {
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + expiresIn;
	const token = jwt.sign(
		{
			iss: TOKEN_ISSUER,
			sub: userId,
			iat: issuedAt,
			exp: expiresAt
		} satisfies Payload,
		secret,
		{ algorithm: "HS256" },
	)

	return token;
}

export function validateJwt(tokenString: string, secret: string): string {
	let decoded: Payload;
	try {
		decoded = jwt.verify(tokenString, secret) as JwtPayload;
	} catch (err) {
		console.log('err:', err);
		throw new UnauthorizedError('Invalid token');
	}

	if(decoded.iss !== TOKEN_ISSUER) {
		throw new UnauthorizedError('Invalid issuer');
	}

	if(!decoded.sub) {
		throw new UnauthorizedError('No userId in token')
	}

	return decoded.sub;
}

export function getBearerToken(req: Request): string {
	const authorization = req.get('Authorization');
	if(!authorization){ 
		throw new NotFoundError('No Auth header found');
	}
	const [bearer, tokenStr] = authorization.split(' ');
	return tokenStr;
}