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

const RANGE = /^\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?$/;
const ECHO_FIELDS = [
	'bean', 'roaster', 'method', 'method_name', 'dose_g', 'yield_g', 'time_s',
	'water_g', 'temperature_c', 'bloom_time_s', 'total_time_s', 'brewer', 'notes'
];

function field(formData, name) {
	const value = formData.get(name);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

export function parseDialinForm(formData) {
	const errors = {};

	const bean = field(formData, 'bean');
	const roaster = field(formData, 'roaster');
	const method = field(formData, 'method');
	if (!bean) errors.bean = 'Bean is required.';
	if (!roaster) errors.roaster = 'Roaster is required.';
	if (method !== 'espresso' && method !== 'pourover') errors.method = 'Pick espresso or pour over.';

	const numeric = (name, label) => {
		const raw = field(formData, name);
		if (raw === null) return null;
		const n = Number(raw);
		if (!Number.isFinite(n) || n <= 0) {
			errors[name] = `${label} must be a positive number.`;
			return null;
		}
		return n;
	};
	const rangeText = (name, label) => {
		const raw = field(formData, name);
		if (raw === null) return null;
		if (!RANGE.test(raw)) {
			errors[name] = `${label} must be a number or a range like 25-30.`;
			return null;
		}
		return raw;
	};

	const dose_g = numeric('dose_g', 'Dose');
	const yield_g = numeric('yield_g', 'Yield');
	const water_g = numeric('water_g', 'Water');
	const temperature_c = numeric('temperature_c', 'Temperature');
	const time_s = rangeText('time_s', 'Time');
	const bloom_time_s = rangeText('bloom_time_s', 'Bloom time');
	const total_time_s = rangeText('total_time_s', 'Total time');

	const grinds = [];
	const seenGrindTypes = new Set();
	const grindTypes = formData.getAll('grind_type').map(v => String(v).trim());
	const grindSettings = formData.getAll('grind_setting').map(v => String(v).trim());
	for (let i = 0; i < Math.max(grindTypes.length, grindSettings.length); i++) {
		const type = grindTypes[i] || null;
		const setting = grindSettings[i] || '';
		if (!type && !setting) continue;
		if (!setting || !RANGE.test(setting)) {
			errors.grinds = 'Every grind row needs a setting — a number or a range like 7-8.';
			continue;
		}
		if (seenGrindTypes.has(type)) {
			errors.grinds = 'Each grinder can appear only once.';
			continue;
		}
		seenGrindTypes.add(type);
		grinds.push({ type, setting });
	}

	const pours = [];
	const pourWater = formData.getAll('pour_water').map(v => String(v).trim());
	const pourTime = formData.getAll('pour_time').map(v => String(v).trim());
	const pourNotes = formData.getAll('pour_notes').map(v => String(v).trim());
	for (let i = 0; i < Math.max(pourWater.length, pourTime.length, pourNotes.length); i++) {
		if (!pourWater[i] && !pourTime[i] && !pourNotes[i]) continue;
		const water = Number(pourWater[i]);
		const time = Number(pourTime[i]);
		const waterOk = pourWater[i] && Number.isFinite(water) && water > 0;
		const timeOk = pourTime[i] !== '' && pourTime[i] !== undefined && Number.isFinite(time) && time >= 0;
		if (!waterOk || !timeOk) {
			errors.pours = 'Every pour needs water (g) and time (s).';
			continue;
		}
		pours.push({ water_g: water, time_s: time, notes: pourNotes[i] || null });
	}

	if (Object.keys(errors).length > 0) {
		const values = {};
		for (const name of ECHO_FIELDS) values[name] = String(formData.get(name) ?? '');
		return { ok: false, errors, values };
	}

	return {
		ok: true,
		dialin: {
			bean,
			roaster,
			method,
			method_name: method === 'pourover' ? field(formData, 'method_name') : null,
			dose_g,
			yield_g: method === 'espresso' ? yield_g : null,
			time_s,
			water_g: method === 'pourover' ? water_g : null,
			temperature_c,
			bloom_time_s: method === 'pourover' ? bloom_time_s : null,
			total_time_s: method === 'pourover' ? total_time_s : null,
			brewer: method === 'pourover' ? field(formData, 'brewer') : null,
			grinds,
			pours: method === 'pourover' && pours.length > 0 ? pours : null,
			notes: field(formData, 'notes')
		}
	};
}
