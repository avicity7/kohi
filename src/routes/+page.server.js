import { listDialins } from '$lib/server/db.js';

export async function load({ locals }) {
	return { dialins: await listDialins(), authed: locals.authed };
}
