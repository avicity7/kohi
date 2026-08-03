export function formatRange(value) {
	return String(value).replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
}

export function matchesQuery(entry, query) {
	const q = (query ?? '').trim().toLowerCase();
	if (!q) return true;
	return [
		entry.bean,
		entry.roaster,
		entry.notes,
		entry.brewer,
		entry.method_name,
		...getGrinds(entry).map(g => g.type)
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase()
		.includes(q);
}

export function getGrinderNames(entries) {
	const names = [];
	for (const entry of entries) {
		for (const { type } of getGrinds(entry)) {
			if (type && !names.includes(type)) names.push(type);
		}
	}
	return names;
}

export function filterEntries(entries, { query = '', method = null, grinder = null } = {}) {
	return entries.filter(
		e =>
			matchesQuery(e, query) &&
			(!method || e.method === method) &&
			(!grinder || getGrinds(e).some(g => g.type === grinder))
	);
}

export function getGrinds(entry) {
	return entry.grinds ?? [];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86400000;

// UTC calendar days keep the label identical between server render and hydration.
export function formatRelativeDate(value, now = new Date()) {
	if (!value) return '';
	const then = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(then.getTime())) return '';
	const days = Math.floor(now.getTime() / DAY_MS) - Math.floor(then.getTime() / DAY_MS);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	if (days < 7) return `${days}d ago`;
	if (days < 56) return `${Math.floor(days / 7)}w ago`;
	if (then.getUTCFullYear() === now.getUTCFullYear())
		return `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}`;
	return `${MONTHS[then.getUTCMonth()]} ${then.getUTCFullYear()}`;
}
