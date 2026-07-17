const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const UNSPECIFIED_HOSTNAMES = new Set(['0.0.0.0', '[::]', '::']);

/**
 * Accept only same-origin paths. This value is later passed to router/location,
 * so backslashes and control characters are rejected as well as protocol-relative
 * URLs.
 */
export function safeCallbackPath(value: string | null | undefined, fallback = '/client') {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTER.test(value)
  ) {
    return fallback;
  }

  try {
    const base = new URL('http://eaumalik.local');
    const parsed = new URL(value, base);
    return parsed.origin === base.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 0.0.0.0/[::] are server bind addresses, not stable browser destinations.
 * Preserve the current protocol and port but use localhost for a local browser.
 */
export function browserSafeOrigin(origin: string) {
  const parsed = new URL(origin);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Origine HTTP invalide.');
  }

  if (UNSPECIFIED_HOSTNAMES.has(parsed.hostname)) {
    parsed.hostname = 'localhost';
  }

  return parsed.origin;
}
