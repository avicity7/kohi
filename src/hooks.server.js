import { env } from '$env/dynamic/private';
import { verifySession, SESSION_COOKIE } from '$lib/server/session.js';

export async function handle({ event, resolve }) {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.authed = Boolean(token && env.SESSION_SECRET && verifySession(token, env.SESSION_SECRET));
	return resolve(event);
}
