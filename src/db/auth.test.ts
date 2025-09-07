import { describe, it, expect, beforeAll } from 'vitest';
import { makeJwt, validateJwt } from './auth';
import { UnauthorizedError } from '../config.js';

const mockJwt = {
  "exp": 1757184824,
  "iat": 1757184764,
  "iss": "chirpy",
  "sub": "78ad3bd4-01da-4841-9991-390d8ed6dd58!",
}


describe("Jwt Token Validation", () => {
  const userId = "78ad3bd4-01da-4841-9991-390d8ed6dd58!";
  const SECRET = 'someStellarSecretNobodyKnows123';
  const wrongSecret = 'thisIsNotTheWrightSecret';
  let jwt1: string;

  beforeAll(async () => {
    jwt1 = await makeJwt(userId, 3600, SECRET);
  });

  it("should validate a valid jwt", async () => {
    const result = await validateJwt(jwt1, SECRET);
    expect(result).toBe(userId);
  });

  it("should throw an error for an invalid token", () => {
  	expect(() => validateJwt("invalid.token.string", SECRET)).toThrow(
  		UnauthorizedError,
  	)
  });

  it("should throw an error for an invalid secret", () => {
  	expect(() => validateJwt(jwt1, wrongSecret)).toThrow(
  		UnauthorizedError,
  	)
  });
});