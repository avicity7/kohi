import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRelativeDate } from './index.js';

const now = new Date('2026-08-03T12:00:00Z');

test('same day is today', () => {
	assert.equal(formatRelativeDate(new Date('2026-08-03T01:00:00Z'), now), 'today');
});

test('previous day is yesterday', () => {
	assert.equal(formatRelativeDate('2026-08-02T23:00:00Z', now), 'yesterday');
});

test('under a week is days ago', () => {
	assert.equal(formatRelativeDate('2026-07-31T12:00:00Z', now), '3d ago');
});

test('under eight weeks is weeks ago', () => {
	assert.equal(formatRelativeDate('2026-06-29T12:00:00Z', now), '5w ago');
});

test('same year falls back to day-month', () => {
	assert.equal(formatRelativeDate('2026-02-26T12:00:00Z', now), '26 Feb');
});

test('older years include the year', () => {
	assert.equal(formatRelativeDate('2025-06-12T12:00:00Z', now), 'Jun 2025');
});

test('missing and invalid input return empty string', () => {
	assert.equal(formatRelativeDate(null, now), '');
	assert.equal(formatRelativeDate('not a date', now), '');
});
