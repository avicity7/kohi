import { neon } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';

let client;

function sql() {
	if (!client) client = neon(env.DATABASE_URL);
	return client;
}

// Postgres `numeric` comes back from the driver as a string; normalize to JS numbers.
function fromRow(row) {
	return {
		...row,
		dose_g: row.dose_g === null ? null : Number(row.dose_g),
		yield_g: row.yield_g === null ? null : Number(row.yield_g),
		water_g: row.water_g === null ? null : Number(row.water_g),
		temperature_c: row.temperature_c === null ? null : Number(row.temperature_c)
	};
}

export async function listDialins() {
	const rows = await sql()`SELECT * FROM dialins ORDER BY updated_at DESC, id DESC`;
	return rows.map(fromRow);
}

export async function createDialin(d) {
	await sql()`
		INSERT INTO dialins
			(bean, roaster, method, method_name, dose_g, yield_g, time_s,
			 water_g, temperature_c, bloom_time_s, total_time_s, brewer,
			 grinds, pours, notes)
		VALUES
			(${d.bean}, ${d.roaster}, ${d.method}, ${d.method_name}, ${d.dose_g}, ${d.yield_g}, ${d.time_s},
			 ${d.water_g}, ${d.temperature_c}, ${d.bloom_time_s}, ${d.total_time_s}, ${d.brewer},
			 ${JSON.stringify(d.grinds)}::jsonb, ${d.pours ? JSON.stringify(d.pours) : null}::jsonb, ${d.notes})`;
}

export async function updateDialin(id, d) {
	await sql()`
		UPDATE dialins SET
			bean = ${d.bean}, roaster = ${d.roaster}, method = ${d.method}, method_name = ${d.method_name},
			dose_g = ${d.dose_g}, yield_g = ${d.yield_g}, time_s = ${d.time_s},
			water_g = ${d.water_g}, temperature_c = ${d.temperature_c},
			bloom_time_s = ${d.bloom_time_s}, total_time_s = ${d.total_time_s}, brewer = ${d.brewer},
			grinds = ${JSON.stringify(d.grinds)}::jsonb,
			pours = ${d.pours ? JSON.stringify(d.pours) : null}::jsonb,
			notes = ${d.notes},
			updated_at = now()
		WHERE id = ${id}`;
}

export async function deleteDialin(id) {
	await sql()`DELETE FROM dialins WHERE id = ${id}`;
}
