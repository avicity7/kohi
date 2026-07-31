import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fromYamlShape, toYamlShape } from './dialin.js';

describe('fromYamlShape', () => {
	it('parses a typed espresso entry', () => {
		const d = fromYamlShape({
			bean: 'Forte',
			roaster: 'Jewel Coffee Cafe Monza',
			method: 'espresso',
			dose_g: 18,
			yield_g: 35,
			time_s: 30,
			'grind(K6)': 26,
			notes: 'Medium roast.'
		});
		assert.equal(d.bean, 'Forte');
		assert.equal(d.method, 'espresso');
		assert.equal(d.dose_g, 18);
		assert.equal(d.time_s, '30');
		assert.deepEqual(d.grinds, [{ type: 'K6', setting: '26' }]);
		assert.equal(d.pours, null);
		assert.equal(d.water_g, null);
	});

	it('parses multiple grinders in key order and legacy untyped grind', () => {
		const multi = fromYamlShape({ bean: 'X', roaster: 'Y', method: 'espresso', 'grind(Breville)': '7-8', 'grind(K6)': 28 });
		assert.deepEqual(multi.grinds, [
			{ type: 'Breville', setting: '7-8' },
			{ type: 'K6', setting: '28' }
		]);
		const legacy = fromYamlShape({ bean: 'X', roaster: 'Y', method: 'espresso', grind: '14-15' });
		assert.deepEqual(legacy.grinds, [{ type: null, setting: '14-15' }]);
	});

	it('parses a pour-over entry with pours', () => {
		const d = fromYamlShape({
			bean: 'Ethiopia',
			roaster: 'Square Mile',
			method: 'pourover',
			method_name: '4:6 Method',
			dose_g: 20,
			water_g: 300,
			grind: 22,
			temperature_c: 92,
			brewer: 'V60',
			pours: [{ water_g: 60, time_s: 0, notes: 'Bloom' }]
		});
		assert.equal(d.method_name, '4:6 Method');
		assert.equal(d.water_g, 300);
		assert.deepEqual(d.pours, [{ water_g: 60, time_s: 0, notes: 'Bloom' }]);
	});
});

describe('toYamlShape', () => {
	it('reconstructs grind keys and numeric-looking values', () => {
		const out = toYamlShape({
			bean: 'Forte', roaster: 'Jewel', method: 'espresso', method_name: null,
			dose_g: 18, yield_g: 35, time_s: '30',
			water_g: null, temperature_c: null, bloom_time_s: null, total_time_s: null, brewer: null,
			grinds: [{ type: 'K6', setting: '26' }], pours: null, notes: 'Medium roast.'
		});
		assert.deepEqual(out, {
			bean: 'Forte', roaster: 'Jewel', method: 'espresso',
			dose_g: 18, yield_g: 35, time_s: 30, 'grind(K6)': 26, notes: 'Medium roast.'
		});
	});

	it('keeps ranges as strings and untyped grind as plain key', () => {
		const out = toYamlShape({
			bean: 'Grizzly Claw', roaster: 'Kick Horse', method: 'espresso', method_name: null,
			dose_g: 16, yield_g: 30, time_s: '28',
			water_g: null, temperature_c: null, bloom_time_s: null, total_time_s: null, brewer: null,
			grinds: [{ type: null, setting: '14-15' }], pours: null, notes: null
		});
		assert.equal(out.grind, '14-15');
		assert.equal('notes' in out, false);
	});

	it('round-trips: fromYamlShape(toYamlShape(d)) === d', () => {
		const d = {
			bean: 'Ethiopia', roaster: 'Square Mile', method: 'pourover', method_name: '4:6 Method',
			dose_g: 20, yield_g: null, time_s: null,
			water_g: 300, temperature_c: 92, bloom_time_s: null, total_time_s: '210', brewer: 'V60',
			grinds: [{ type: 'K6', setting: '22' }],
			pours: [{ water_g: 60, time_s: 0, notes: 'Bloom' }, { water_g: 60, time_s: 45, notes: null }],
			notes: 'Bright.'
		};
		assert.deepEqual(fromYamlShape(toYamlShape(d)), d);
	});
});

import { parseDialinForm } from './dialin.js';

function fd(fields, multi = {}) {
	const data = new FormData();
	for (const [k, v] of Object.entries(fields)) data.append(k, v);
	for (const [k, list] of Object.entries(multi)) for (const v of list) data.append(k, v);
	return data;
}

describe('parseDialinForm', () => {
	it('parses a complete espresso form', () => {
		const result = parseDialinForm(
			fd(
				{ bean: 'Forte', roaster: 'Jewel', method: 'espresso', dose_g: '18', yield_g: '35', time_s: '30', notes: 'Nice.' },
				{ grind_type: ['K6'], grind_setting: ['26'] }
			)
		);
		assert.equal(result.ok, true);
		assert.deepEqual(result.dialin, {
			bean: 'Forte', roaster: 'Jewel', method: 'espresso', method_name: null,
			dose_g: 18, yield_g: 35, time_s: '30',
			water_g: null, temperature_c: null, bloom_time_s: null, total_time_s: null, brewer: null,
			grinds: [{ type: 'K6', setting: '26' }], pours: null, notes: 'Nice.'
		});
	});

	it('requires bean, roaster, and a valid method', () => {
		const result = parseDialinForm(fd({ bean: ' ', roaster: '', method: 'siphon' }));
		assert.equal(result.ok, false);
		assert.ok(result.errors.bean);
		assert.ok(result.errors.roaster);
		assert.ok(result.errors.method);
	});

	it('rejects non-positive numbers and bad ranges', () => {
		const result = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso', dose_g: '-1', time_s: '30-' })
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.dose_g);
		assert.ok(result.errors.time_s);
	});

	it('accepts ranges with spaces and drops empty grind rows', () => {
		const result = parseDialinForm(
			fd(
				{ bean: 'X', roaster: 'Y', method: 'espresso', time_s: '25 - 26' },
				{ grind_type: ['', 'K6'], grind_setting: ['', '27'] }
			)
		);
		assert.equal(result.ok, true);
		assert.equal(result.dialin.time_s, '25 - 26');
		assert.deepEqual(result.dialin.grinds, [{ type: 'K6', setting: '27' }]);
	});

	it('flags a grind row with a type but no setting', () => {
		const result = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso' }, { grind_type: ['K6'], grind_setting: [''] })
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.grinds);
	});

	it('rejects duplicate grinder rows', () => {
		const dupTyped = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso' }, { grind_type: ['K6', 'K6'], grind_setting: ['27', '28'] })
		);
		assert.equal(dupTyped.ok, false);
		assert.ok(dupTyped.errors.grinds);
		const dupUntyped = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso' }, { grind_type: ['', ''], grind_setting: ['14', '15'] })
		);
		assert.equal(dupUntyped.ok, false);
		assert.ok(dupUntyped.errors.grinds);
		const distinct = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso' }, { grind_type: ['Breville', 'K6'], grind_setting: ['7-8', '28'] })
		);
		assert.equal(distinct.ok, true);
	});

	it('parses pour-over with pours; time 0 is allowed', () => {
		const result = parseDialinForm(
			fd(
				{
					bean: 'Ethiopia', roaster: 'SM', method: 'pourover', method_name: '4:6 Method',
					dose_g: '20', water_g: '300', temperature_c: '92', brewer: 'V60'
				},
				{ pour_water: ['60', '60'], pour_time: ['0', '45'], pour_notes: ['Bloom', ''] }
			)
		);
		assert.equal(result.ok, true);
		assert.deepEqual(result.dialin.pours, [
			{ water_g: 60, time_s: 0, notes: 'Bloom' },
			{ water_g: 60, time_s: 45, notes: null }
		]);
	});

	it('flags incomplete pour rows', () => {
		const result = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'pourover' }, { pour_water: ['60'], pour_time: [''], pour_notes: [''] })
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.pours);
	});

	it('nulls out cross-method fields', () => {
		const espresso = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso', water_g: '300', brewer: 'V60', method_name: 'Z' })
		);
		assert.equal(espresso.ok, true);
		assert.equal(espresso.dialin.water_g, null);
		assert.equal(espresso.dialin.brewer, null);
		assert.equal(espresso.dialin.method_name, null);
		const pourover = parseDialinForm(fd({ bean: 'X', roaster: 'Y', method: 'pourover', yield_g: '35' }));
		assert.equal(pourover.ok, true);
		assert.equal(pourover.dialin.yield_g, null);
	});

	it('echoes raw values on failure', () => {
		const result = parseDialinForm(fd({ bean: '', roaster: 'Y', method: 'espresso', dose_g: '18' }));
		assert.equal(result.ok, false);
		assert.equal(result.values.roaster, 'Y');
		assert.equal(result.values.dose_g, '18');
	});
});
