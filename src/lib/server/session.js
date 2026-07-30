import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'kohi_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(value, secret) {
	return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSession(secret, now = Date.now(), ttlMs = SESSION_TTL_MS) {
	const expiresAt = now + ttlMs;
	return `${expiresAt}.${sign(String(expiresAt), secret)}`;
}

export function verifySession(token, secret, now = Date.now()) {
	if (typeof token !== 'string') return false;
	const dot = token.indexOf('.');
	if (dot === -1) return false;
	const expiresAt = token.slice(0, dot);
	const signature = token.slice(dot + 1);
	if (!/^\d+$/.test(expiresAt)) return false;
	const expected = Buffer.from(sign(expiresAt, secret));
	const actual = Buffer.from(signature);
	if (actual.length !== expected.length) return false;
	if (!timingSafeEqual(actual, expected)) return false;
	return Number(expiresAt) > now;
}

export function passwordMatches(input, expected) {
	const a = createHash('sha256').update(String(input ?? '')).digest();
	const b = createHash('sha256').update(String(expected ?? '')).digest();
	return timingSafeEqual(a, b);
}
