import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	createSession,
	verifySession,
	passwordMatches,
	SESSION_COOKIE,
	SESSION_TTL_MS
} from './session.js';

const SECRET = 'test-secret-at-least-32-chars-long!!';
const NOW = 1_800_000_000_000;

describe('createSession / verifySession', () => {
	it('round-trips a fresh token', () => {
		const token = createSession(SECRET, NOW);
		assert.equal(verifySession(token, SECRET, NOW), true);
	});

	it('embeds expiry = now + ttl', () => {
		const token = createSession(SECRET, NOW, 1000);
		assert.equal(token.split('.')[0], String(NOW + 1000));
	});

	it('rejects an expired token', () => {
		const token = createSession(SECRET, NOW, 1000);
		assert.equal(verifySession(token, SECRET, NOW + 1001), false);
	});

	it('rejects a tampered expiry', () => {
		const token = createSession(SECRET, NOW, 1000);
		const [, sig] = token.split('.');
		assert.equal(verifySession(`${NOW + 999999999}.${sig}`, SECRET, NOW), false);
	});

	it('rejects a token signed with a different secret', () => {
		const token = createSession('other-secret-that-is-also-long-enough', NOW);
		assert.equal(verifySession(token, SECRET, NOW), false);
	});

	it('rejects garbage', () => {
		assert.equal(verifySession(undefined, SECRET, NOW), false);
		assert.equal(verifySession('', SECRET, NOW), false);
		assert.equal(verifySession('no-dot-here', SECRET, NOW), false);
		assert.equal(verifySession('abc.def', SECRET, NOW), false);
	});
});

describe('passwordMatches', () => {
	it('accepts the exact password', () => {
		assert.equal(passwordMatches('open sesame', 'open sesame'), true);
	});

	it('rejects wrong, empty, and non-string input', () => {
		assert.equal(passwordMatches('open sesam', 'open sesame'), false);
		assert.equal(passwordMatches('', 'open sesame'), false);
		assert.equal(passwordMatches(undefined, 'open sesame'), false);
	});
});

describe('constants', () => {
	it('exports the cookie name and a 30-day ttl', () => {
		assert.equal(SESSION_COOKIE, 'kohi_session');
		assert.equal(SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000);
	});
});
