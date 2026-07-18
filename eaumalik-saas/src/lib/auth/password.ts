import 'server-only';
import crypto from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1 } as const;

/** Hash a password for the local/mock repository. Never store mock passwords raw. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${SCRYPT_PREFIX}$${salt}$${key.toString('hex')}`;
}

export function isHashedPassword(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${SCRYPT_PREFIX}$`);
}

/**
 * Verify a mock password and accept the old raw format only long enough to
 * migrate an existing local data file. New writes always use scrypt.
 */
export function verifyPassword(password: string, stored: unknown): boolean {
  if (typeof stored !== 'string') return false;

  if (!isHashedPassword(stored)) {
    return stored === password;
  }

  const [, salt, encodedKey] = stored.split('$');
  if (!salt || !encodedKey || !/^[0-9a-f]+$/i.test(encodedKey)) return false;

  try {
    const actual = Buffer.from(encodedKey, 'hex');
    const expected = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
