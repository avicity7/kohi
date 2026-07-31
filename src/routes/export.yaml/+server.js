import yaml from 'js-yaml';
import { listDialins } from '$lib/server/db.js';
import { toYamlShape } from '$lib/server/dialin.js';

export async function GET() {
	const dialins = await listDialins();
	const text = yaml.dump(dialins.map(toYamlShape), { lineWidth: -1 });
	return new Response(text, {
		headers: { 'content-type': 'text/yaml; charset=utf-8' }
	});
}
