import yaml from 'js-yaml';
import { base } from '$app/paths';

export async function load({ fetch }) {
	const res = await fetch(`${base}/dialins.yaml`);
	const text = await res.text();
	const dialins = yaml.load(text);
	return { dialins };
}
