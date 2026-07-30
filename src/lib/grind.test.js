import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as lib from './index.js';

describe('formatRange', () => {
	it('replaces a hyphen between numbers with an en dash', () => {
		assert.equal(lib.formatRange('7-8'), '7–8');
		assert.equal(lib.formatRange('25 - 26'), '25–26');
	});

	it('leaves single values untouched', () => {
		assert.equal(lib.formatRange(28), '28');
		assert.equal(lib.formatRange('14'), '14');
	});
});

describe('matchesQuery', () => {
	const entry = {
		bean: 'Grizzly Claw',
		roaster: 'Kick Horse',
		notes: 'Dark roast with little bitterness.',
		grinds: [{ type: 'K6', setting: '28' }]
	};

	it('matches any field case-insensitively, including grinder names', () => {
		assert.equal(lib.matchesQuery(entry, 'grizzly'), true);
		assert.equal(lib.matchesQuery(entry, 'KICK'), true);
		assert.equal(lib.matchesQuery(entry, 'bitterness'), true);
		assert.equal(lib.matchesQuery(entry, 'k6'), true);
	});

	it('returns false when nothing matches', () => {
		assert.equal(lib.matchesQuery(entry, 'ethiopia'), false);
	});

	it('matches everything on an empty or blank query', () => {
		assert.equal(lib.matchesQuery(entry, ''), true);
		assert.equal(lib.matchesQuery(entry, '   '), true);
		assert.equal(lib.matchesQuery(entry, undefined), true);
	});
});

describe('getGrinderNames', () => {
	it('returns unique grinder names in first-seen order', () => {
		const entries = [
			{ grinds: [{ type: 'Breville', setting: '7' }, { type: 'K6', setting: '28' }] },
			{ grinds: [{ type: null, setting: '14' }] },
			{ grinds: [{ type: 'K6', setting: '30' }] }
		];
		assert.deepEqual(lib.getGrinderNames(entries), ['Breville', 'K6']);
	});

	it('returns an empty list when no entry names a grinder', () => {
		assert.deepEqual(lib.getGrinderNames([{ grinds: [{ type: null, setting: '7' }] }, { bean: 'X' }]), []);
	});
});

describe('filterEntries', () => {
	const entries = [
		{ bean: 'Espresso', roaster: 'Lavazza', method: 'espresso', grinds: [{ type: 'K6', setting: '28' }] },
		{ bean: 'Grizzly Claw', roaster: 'Kick Horse', method: 'espresso', grinds: [{ type: null, setting: '14' }] },
		{ bean: 'Colombia Huila', roaster: 'Onyx', method: 'pourover', grinds: [{ type: 'Breville', setting: '24' }] }
	];

	it('returns everything with no filters', () => {
		assert.deepEqual(lib.filterEntries(entries, {}), entries);
		assert.deepEqual(lib.filterEntries(entries), entries);
	});

	it('filters by method', () => {
		assert.deepEqual(
			lib.filterEntries(entries, { method: 'pourover' }).map(e => e.bean),
			['Colombia Huila']
		);
	});

	it('filters by grinder name', () => {
		assert.deepEqual(
			lib.filterEntries(entries, { grinder: 'K6' }).map(e => e.bean),
			['Espresso']
		);
	});

	it('combines query, method, and grinder filters', () => {
		assert.deepEqual(
			lib.filterEntries(entries, { query: 'lavazza', method: 'espresso', grinder: 'K6' }).map(e => e.bean),
			['Espresso']
		);
		assert.deepEqual(lib.filterEntries(entries, { query: 'lavazza', method: 'pourover' }), []);
	});
});

describe('getGrinds', () => {
	it('returns the grinds array as-is', () => {
		const grinds = [{ type: 'K6', setting: '27' }, { type: null, setting: '7-8' }];
		assert.deepEqual(lib.getGrinds({ grinds }), grinds);
	});

	it('returns an empty array when grinds is missing or null', () => {
		assert.deepEqual(lib.getGrinds({ bean: 'Espresso' }), []);
		assert.deepEqual(lib.getGrinds({ grinds: null }), []);
	});
});
