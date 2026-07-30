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
