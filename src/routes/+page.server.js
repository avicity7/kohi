import { fail, redirect } from '@sveltejs/kit';
import { listDialins, createDialin, updateDialin, deleteDialin } from '$lib/server/db.js';
import { parseDialinForm } from '$lib/server/dialin.js';
import { SESSION_COOKIE } from '$lib/server/session.js';

export async function load({ locals }) {
	return { dialins: await listDialins(), authed: locals.authed };
}

const AUTH_FAIL = { message: 'Your session has expired — sign in again.' };

function parseId(formData) {
	const id = Number(formData.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions = {
	create: async ({ request, locals }) => {
		if (!locals.authed) return fail(403, AUTH_FAIL);
		const parsed = parseDialinForm(await request.formData());
		if (!parsed.ok) return fail(400, { errors: parsed.errors, values: parsed.values });
		try {
			await createDialin(parsed.dialin);
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Saving failed — try again.' });
		}
		return { saved: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.authed) return fail(403, AUTH_FAIL);
		const formData = await request.formData();
		const id = parseId(formData);
		if (!id) return fail(400, { message: 'Missing entry id.' });
		const parsed = parseDialinForm(formData);
		if (!parsed.ok) return fail(400, { errors: parsed.errors, values: parsed.values });
		try {
			await updateDialin(id, parsed.dialin);
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Saving failed — try again.' });
		}
		return { saved: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.authed) return fail(403, AUTH_FAIL);
		const id = parseId(await request.formData());
		if (!id) return fail(400, { message: 'Missing entry id.' });
		try {
			await deleteDialin(id);
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Delete failed — try again.' });
		}
		return { deleted: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/');
	}
};
