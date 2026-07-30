// Pure dialin shape helpers — no SvelteKit or env imports (db/seed.js runs this in plain Node).

const GRIND_KEY = /^grind(?:\((.*)\))?$/;
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

function maybeNumber(text) {
	return PLAIN_NUMBER.test(text) ? Number(text) : text;
}

function textOrNull(value) {
	return value == null ? null : String(value);
}

export function fromYamlShape(entry) {
	const grinds = [];
	for (const [key, value] of Object.entries(entry)) {
		const match = key.match(GRIND_KEY);
		if (match) grinds.push({ type: match[1]?.trim() || null, setting: String(value) });
	}
	return {
		bean: entry.bean,
		roaster: entry.roaster,
		method: entry.method,
		method_name: entry.method_name ?? null,
		dose_g: entry.dose_g ?? null,
		yield_g: entry.yield_g ?? null,
		time_s: textOrNull(entry.time_s),
		water_g: entry.water_g ?? null,
		temperature_c: entry.temperature_c ?? null,
		bloom_time_s: textOrNull(entry.bloom_time_s),
		total_time_s: textOrNull(entry.total_time_s),
		brewer: entry.brewer ?? null,
		grinds,
		pours: entry.pours
			? entry.pours.map(p => ({ water_g: p.water_g, time_s: p.time_s, notes: p.notes ?? null }))
			: null,
		notes: entry.notes ?? null
	};
}

export function toYamlShape(d) {
	const out = { bean: d.bean, roaster: d.roaster, method: d.method };
	if (d.method_name != null) out.method_name = d.method_name;
	if (d.dose_g != null) out.dose_g = d.dose_g;
	if (d.yield_g != null) out.yield_g = d.yield_g;
	if (d.water_g != null) out.water_g = d.water_g;
	if (d.time_s != null) out.time_s = maybeNumber(d.time_s);
	if (d.temperature_c != null) out.temperature_c = d.temperature_c;
	if (d.bloom_time_s != null) out.bloom_time_s = maybeNumber(d.bloom_time_s);
	if (d.total_time_s != null) out.total_time_s = maybeNumber(d.total_time_s);
	if (d.brewer != null) out.brewer = d.brewer;
	for (const grind of d.grinds ?? []) {
		out[grind.type ? `grind(${grind.type})` : 'grind'] = maybeNumber(grind.setting);
	}
	if (d.pours?.length) {
		out.pours = d.pours.map(p => {
			const pour = { water_g: p.water_g, time_s: p.time_s };
			if (p.notes != null) pour.notes = p.notes;
			return pour;
		});
	}
	if (d.notes != null) out.notes = d.notes;
	return out;
}
