// Usage: node --env-file=.env db/seed.js <dialins.yaml> [--replace]
// Plain seed refuses to touch a non-empty table; --replace truncates and reimports.
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { neon } from '@neondatabase/serverless';
import { fromYamlShape } from '../src/lib/server/dialin.js';

const file = process.argv[2];
const replace = process.argv.includes('--replace');

if (!file) {
	console.error('Usage: node --env-file=.env db/seed.js <dialins.yaml> [--replace]');
	process.exit(1);
}
if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL is not set (use --env-file=.env).');
	process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const entries = yaml.load(readFileSync(file, 'utf8')) ?? [];

const [{ count }] = await sql`SELECT count(*)::int AS count FROM dialins`;
if (count > 0 && !replace) {
	console.error(`Table already has ${count} rows; pass --replace to truncate and reimport.`);
	process.exit(1);
}
if (replace) await sql`TRUNCATE dialins RESTART IDENTITY`;

// File order is newest-first; insert oldest-first with timestamps staggered
// one minute apart so `ORDER BY created_at DESC` reproduces the file order.
const base = Date.now() - (entries.length + 1) * 60_000;
for (let i = entries.length - 1; i >= 0; i--) {
	const d = fromYamlShape(entries[i]);
	const createdAt = new Date(base + (entries.length - i) * 60_000).toISOString();
	await sql`
		INSERT INTO dialins
			(bean, roaster, method, method_name, dose_g, yield_g, time_s,
			 water_g, temperature_c, bloom_time_s, total_time_s, brewer,
			 grinds, pours, notes, created_at, updated_at)
		VALUES
			(${d.bean}, ${d.roaster}, ${d.method}, ${d.method_name}, ${d.dose_g}, ${d.yield_g}, ${d.time_s},
			 ${d.water_g}, ${d.temperature_c}, ${d.bloom_time_s}, ${d.total_time_s}, ${d.brewer},
			 ${JSON.stringify(d.grinds)}::jsonb, ${d.pours ? JSON.stringify(d.pours) : null}::jsonb, ${d.notes},
			 ${createdAt}, ${createdAt})`;
}

console.log(`Seeded ${entries.length} entries from ${file}.`);
