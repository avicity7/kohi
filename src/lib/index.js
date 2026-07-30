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
