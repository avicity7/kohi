import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_TTL_MS } from '$lib/server/session.js';

// The root layout still forces site-wide prerendering (removed in Task 9); a route with
// form actions cannot be prerendered, so this route opts out locally until then.
export const prerender = false;

export function load({ locals }) {
	if (locals.authed) redirect(303, '/');
}

export const actions = {
	login: async ({ request, cookies }) => {
		if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
			return fail(500, { message: 'Login is not configured on this deployment.' });
		}
		const formData = await request.formData();
		if (!passwordMatches(formData.get('password'), env.ADMIN_PASSWORD)) {
			await new Promise(resolve => setTimeout(resolve, 500));
			return fail(400, { message: 'Wrong password.' });
		}
		cookies.set(SESSION_COOKIE, createSession(env.SESSION_SECRET), {
			path: '/',
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax',
			maxAge: SESSION_TTL_MS / 1000
		});
		redirect(303, '/');
	}
};
