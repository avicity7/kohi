# Kohi Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move kohi from GitHub Pages (static, YAML-file data) to Vercel with dial-ins in Neon Postgres and password-gated in-app editing (add/edit/delete, espresso + pour-over).

**Architecture:** SvelteKit 2 + Svelte 5 stays; `adapter-static` becomes `@sveltejs/adapter-vercel` and the single page becomes server-rendered from Postgres via a `+page.server.js` load. All mutations are SvelteKit form actions gated by an HMAC-signed session cookie (`ADMIN_PASSWORD` + `SESSION_SECRET` env vars, no auth library). A drawer (`<dialog>`) component handles add/edit; `GET /export.yaml` reproduces the original YAML format as backup, and `db/seed.js` is both the one-time import and the restore path.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), `@neondatabase/serverless`, `js-yaml`, `node:test`, Vercel + Neon (via Vercel Marketplace).

**Spec:** `docs/superpowers/specs/2026-07-30-kohi-vercel-migration-design.md`

## Global Constraints

- Plain JavaScript (no TypeScript files), ESM, tab indentation, single quotes — match existing code style.
- Svelte 5 runes syntax only (`$props`, `$state`, `$derived`, `$effect`, `bind:` on `$state`); SvelteKit 2 idioms (`redirect(303, …)` and `fail(…)` from `@sveltejs/kit`, `cookies.set(name, value, { path: … })`).
- Node ≥ 20.6 locally (global `fetch`/`FormData`, `node --env-file`, `node --test`).
- Only two new packages allowed: `@sveltejs/adapter-vercel` (devDependency), `@neondatabase/serverless` (dependency). `js-yaml` stays. No ORM, no auth library, no UI library.
- App code reads env via `$env/dynamic/private` (`env.DATABASE_URL`, `env.ADMIN_PASSWORD`, `env.SESSION_SECRET`); standalone scripts (`db/seed.js`) use `process.env`. `.env` is gitignored — never commit it.
- Session cookie name is exactly `kohi_session`.
- Every mutating form action must independently check `locals.authed` and return `fail(403, …)` when false — no exceptions.
- Database table/columns exactly as `db/schema.sql` (Task 6). The dialin object shape used everywhere is:
  `{ bean, roaster, method, method_name, dose_g, yield_g, time_s, water_g, temperature_c, bloom_time_s, total_time_s, brewer, grinds, pours, notes }`
  where `grinds` = array of `{ type: string|null, setting: string }`, `pours` = `null` or array of `{ water_g: number, time_s: number, notes: string|null }`, numbers are JS numbers, range-able fields are strings, absent values are `null`.
- New UI must reuse the existing CSS custom properties (`--bg`, `--surface`, `--ink`, `--ink-soft`, `--ink-muted`, `--line`, `--accent`, `--sans`, `--serif`).
- Commit messages: terse lowercase `type: summary` (`feat:`, `chore:`, `refactor:`, `test:`), each ending with the line `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Do not `git push` until Task 13 (Deploy) — the cutover is one push.
- Tests run with `npm test` (`node --test src/`). Run from the repo root: `C:\Users\karluser\Desktop\github\kohi`.

---

### Task 1: Toolchain swap (deps, adapter, manifest, workflow)

**Files:**
- Modify: `package.json`
- Modify: `svelte.config.js`
- Modify: `static/manifest.webmanifest`
- Delete: `.github/workflows/build-and-deploy.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` script (`node --test src/`); `@neondatabase/serverless` importable; `@sveltejs/adapter-vercel` active; site builds for the domain root (no `/kohi` base).

Note: the spec (§9) lists workflow deletion under decommissioning, but it must be deleted in the first commit that gets pushed — otherwise the push in Task 13 triggers a GitHub Pages build of the migrated code, which would fail red (or worse, half-deploy). The currently *deployed* Pages site is unaffected: it serves the existing `gh-pages` branch until Task 14 removes it.

- [ ] **Step 1: Update package.json**

Replace the `scripts`, `devDependencies`, and `dependencies` blocks so the whole file reads:

```json
{
	"name": "kohi",
	"private": true,
	"version": "0.0.1",
	"type": "module",
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"test": "node --test src/",
		"prepare": "svelte-kit sync || echo ''"
	},
	"devDependencies": {
		"@sveltejs/adapter-vercel": "^6.0.0",
		"@sveltejs/kit": "^2.50.2",
		"@sveltejs/vite-plugin-svelte": "^6.2.4",
		"svelte": "^5.49.2",
		"vite": "^7.3.1"
	},
	"dependencies": {
		"@neondatabase/serverless": "^1.0.0",
		"js-yaml": "^4.1.1"
	}
}
```

(Removed: `webpack`, `webpack-cli` — unused, Vite builds the app; `@sveltejs/adapter-static`, `@sveltejs/adapter-auto` — replaced by the Vercel adapter. Added: `test` script.)

- [ ] **Step 2: Install**

Run: `npm install`
Expected: exits 0, lockfile updated, `node_modules/@sveltejs/adapter-vercel` and `node_modules/@neondatabase/serverless` exist. If the pinned majors don't resolve (registry moved on), use `npm install -D @sveltejs/adapter-vercel@latest` and `npm install @neondatabase/serverless@latest` and keep whatever npm writes.

- [ ] **Step 3: Verify existing tests run under the new script**

Run: `npm test`
Expected: PASS — the existing `src/lib/grind.test.js` suite (formatRange, matchesQuery, getGrinderNames, filterEntries, getGrinds) all green.

- [ ] **Step 4: Swap the adapter and drop the base path**

Replace `svelte.config.js` entirely with:

```js
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
```

- [ ] **Step 5: Point the PWA manifest at the root**

In `static/manifest.webmanifest`, change only these two values:

```json
	"start_url": "/",
	"scope": "/",
```

- [ ] **Step 6: Delete the GitHub Pages workflow**

Run: `git rm .github/workflows/build-and-deploy.yaml`

- [ ] **Step 7: Verify the build**

Run: `npm run build`
Expected: exits 0. (The page is still prerendered at this point — `src/routes/+layout.js` still says `prerender = true` and `+page.js` still fetches `/dialins.yaml`, which now resolves at the root. Both are removed in Task 9.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: swap to vercel adapter, remove pages workflow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Session module (sign/verify cookie, password compare)

**Files:**
- Create: `src/lib/server/session.js`
- Test: `src/lib/server/session.test.js`

**Interfaces:**
- Consumes: `node:crypto` only — this module must stay importable by plain `node --test` (no SvelteKit imports, no env reads; secret and clock are parameters).
- Produces:
  - `createSession(secret: string, now?: number, ttlMs?: number): string` — token `"<expiresAtMs>.<base64url hmac>"`
  - `verifySession(token: unknown, secret: string, now?: number): boolean`
  - `passwordMatches(input: unknown, expected: unknown): boolean` — timing-safe
  - `SESSION_COOKIE = 'kohi_session'`, `SESSION_TTL_MS = 2592000000` (30 days)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/session.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	createSession,
	verifySession,
	passwordMatches,
	SESSION_COOKIE,
	SESSION_TTL_MS
} from './session.js';

const SECRET = 'test-secret-at-least-32-chars-long!!';
const NOW = 1_800_000_000_000;

describe('createSession / verifySession', () => {
	it('round-trips a fresh token', () => {
		const token = createSession(SECRET, NOW);
		assert.equal(verifySession(token, SECRET, NOW), true);
	});

	it('embeds expiry = now + ttl', () => {
		const token = createSession(SECRET, NOW, 1000);
		assert.equal(token.split('.')[0], String(NOW + 1000));
	});

	it('rejects an expired token', () => {
		const token = createSession(SECRET, NOW, 1000);
		assert.equal(verifySession(token, SECRET, NOW + 1001), false);
	});

	it('rejects a tampered expiry', () => {
		const token = createSession(SECRET, NOW, 1000);
		const [, sig] = token.split('.');
		assert.equal(verifySession(`${NOW + 999999999}.${sig}`, SECRET, NOW), false);
	});

	it('rejects a token signed with a different secret', () => {
		const token = createSession('other-secret-that-is-also-long-enough', NOW);
		assert.equal(verifySession(token, SECRET, NOW), false);
	});

	it('rejects garbage', () => {
		assert.equal(verifySession(undefined, SECRET, NOW), false);
		assert.equal(verifySession('', SECRET, NOW), false);
		assert.equal(verifySession('no-dot-here', SECRET, NOW), false);
		assert.equal(verifySession('abc.def', SECRET, NOW), false);
	});
});

describe('passwordMatches', () => {
	it('accepts the exact password', () => {
		assert.equal(passwordMatches('open sesame', 'open sesame'), true);
	});

	it('rejects wrong, empty, and non-string input', () => {
		assert.equal(passwordMatches('open sesam', 'open sesame'), false);
		assert.equal(passwordMatches('', 'open sesame'), false);
		assert.equal(passwordMatches(undefined, 'open sesame'), false);
	});
});

describe('constants', () => {
	it('exports the cookie name and a 30-day ttl', () => {
		assert.equal(SESSION_COOKIE, 'kohi_session');
		assert.equal(SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module ... session.js`.

- [ ] **Step 3: Implement the module**

Create `src/lib/server/session.js`:

```js
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'kohi_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(value, secret) {
	return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSession(secret, now = Date.now(), ttlMs = SESSION_TTL_MS) {
	const expiresAt = now + ttlMs;
	return `${expiresAt}.${sign(String(expiresAt), secret)}`;
}

export function verifySession(token, secret, now = Date.now()) {
	if (typeof token !== 'string') return false;
	const dot = token.indexOf('.');
	if (dot === -1) return false;
	const expiresAt = token.slice(0, dot);
	const signature = token.slice(dot + 1);
	if (!/^\d+$/.test(expiresAt)) return false;
	const expected = Buffer.from(sign(expiresAt, secret));
	const actual = Buffer.from(signature);
	if (actual.length !== expected.length) return false;
	if (!timingSafeEqual(actual, expected)) return false;
	return Number(expiresAt) > now;
}

export function passwordMatches(input, expected) {
	const a = createHash('sha256').update(String(input ?? '')).digest();
	const b = createHash('sha256').update(String(expected ?? '')).digest();
	return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all session tests green, grind tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/session.js src/lib/server/session.test.js
git commit -m "feat: session cookie signing and password compare

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: YAML shape mapping (`fromYamlShape` / `toYamlShape`)

**Files:**
- Create: `src/lib/server/dialin.js`
- Test: `src/lib/server/dialin.test.js`

**Interfaces:**
- Consumes: nothing (pure module — no SvelteKit/env imports, ever; `db/seed.js` will import it from plain Node).
- Produces:
  - `fromYamlShape(entry: object): dialin` — parses the YAML entry format, including `grind(K6): 27` / legacy `grind: 14-15` keys, into the canonical dialin object (Global Constraints).
  - `toYamlShape(dialin: object): object` — inverse: emits an object in the original YAML conventions (`grind(K6)` keys, numeric-looking strings back to numbers, absent fields omitted).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/dialin.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fromYamlShape, toYamlShape } from './dialin.js';

describe('fromYamlShape', () => {
	it('parses a typed espresso entry', () => {
		const d = fromYamlShape({
			bean: 'Forte',
			roaster: 'Jewel Coffee Cafe Monza',
			method: 'espresso',
			dose_g: 18,
			yield_g: 35,
			time_s: 30,
			'grind(K6)': 26,
			notes: 'Medium roast.'
		});
		assert.equal(d.bean, 'Forte');
		assert.equal(d.method, 'espresso');
		assert.equal(d.dose_g, 18);
		assert.equal(d.time_s, '30');
		assert.deepEqual(d.grinds, [{ type: 'K6', setting: '26' }]);
		assert.equal(d.pours, null);
		assert.equal(d.water_g, null);
	});

	it('parses multiple grinders in key order and legacy untyped grind', () => {
		const multi = fromYamlShape({ bean: 'X', roaster: 'Y', method: 'espresso', 'grind(Breville)': '7-8', 'grind(K6)': 28 });
		assert.deepEqual(multi.grinds, [
			{ type: 'Breville', setting: '7-8' },
			{ type: 'K6', setting: '28' }
		]);
		const legacy = fromYamlShape({ bean: 'X', roaster: 'Y', method: 'espresso', grind: '14-15' });
		assert.deepEqual(legacy.grinds, [{ type: null, setting: '14-15' }]);
	});

	it('parses a pour-over entry with pours', () => {
		const d = fromYamlShape({
			bean: 'Ethiopia',
			roaster: 'Square Mile',
			method: 'pourover',
			method_name: '4:6 Method',
			dose_g: 20,
			water_g: 300,
			grind: 22,
			temperature_c: 92,
			brewer: 'V60',
			pours: [{ water_g: 60, time_s: 0, notes: 'Bloom' }]
		});
		assert.equal(d.method_name, '4:6 Method');
		assert.equal(d.water_g, 300);
		assert.deepEqual(d.pours, [{ water_g: 60, time_s: 0, notes: 'Bloom' }]);
	});
});

describe('toYamlShape', () => {
	it('reconstructs grind keys and numeric-looking values', () => {
		const out = toYamlShape({
			bean: 'Forte', roaster: 'Jewel', method: 'espresso', method_name: null,
			dose_g: 18, yield_g: 35, time_s: '30',
			water_g: null, temperature_c: null, bloom_time_s: null, total_time_s: null, brewer: null,
			grinds: [{ type: 'K6', setting: '26' }], pours: null, notes: 'Medium roast.'
		});
		assert.deepEqual(out, {
			bean: 'Forte', roaster: 'Jewel', method: 'espresso',
			dose_g: 18, yield_g: 35, time_s: 30, 'grind(K6)': 26, notes: 'Medium roast.'
		});
	});

	it('keeps ranges as strings and untyped grind as plain key', () => {
		const out = toYamlShape({
			bean: 'Grizzly Claw', roaster: 'Kick Horse', method: 'espresso', method_name: null,
			dose_g: 16, yield_g: 30, time_s: '28',
			water_g: null, temperature_c: null, bloom_time_s: null, total_time_s: null, brewer: null,
			grinds: [{ type: null, setting: '14-15' }], pours: null, notes: null
		});
		assert.equal(out.grind, '14-15');
		assert.equal('notes' in out, false);
	});

	it('round-trips: fromYamlShape(toYamlShape(d)) === d', () => {
		const d = {
			bean: 'Ethiopia', roaster: 'Square Mile', method: 'pourover', method_name: '4:6 Method',
			dose_g: 20, yield_g: null, time_s: null,
			water_g: 300, temperature_c: 92, bloom_time_s: null, total_time_s: '210', brewer: 'V60',
			grinds: [{ type: 'K6', setting: '22' }],
			pours: [{ water_g: 60, time_s: 0, notes: 'Bloom' }, { water_g: 60, time_s: 45, notes: null }],
			notes: 'Bright.'
		};
		assert.deepEqual(fromYamlShape(toYamlShape(d)), d);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module ... dialin.js`.

- [ ] **Step 3: Implement**

Create `src/lib/server/dialin.js`:

```js
// Pure dialin shape helpers — no SvelteKit or env imports (db/seed.js runs this in plain Node).

const GRIND_KEY = /^grind(?:\((.*)\))?$/;
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

function maybeNumber(text) {
	return PLAIN_NUMBER.test(text) ? Number(text) : text;
}

function textOrNull(value) {
	return value == null ? null : String(value);
}

export function fromYamlShape(entry) {
	const grinds = [];
	for (const [key, value] of Object.entries(entry)) {
		const match = key.match(GRIND_KEY);
		if (match) grinds.push({ type: match[1]?.trim() || null, setting: String(value) });
	}
	return {
		bean: entry.bean,
		roaster: entry.roaster,
		method: entry.method,
		method_name: entry.method_name ?? null,
		dose_g: entry.dose_g ?? null,
		yield_g: entry.yield_g ?? null,
		time_s: textOrNull(entry.time_s),
		water_g: entry.water_g ?? null,
		temperature_c: entry.temperature_c ?? null,
		bloom_time_s: textOrNull(entry.bloom_time_s),
		total_time_s: textOrNull(entry.total_time_s),
		brewer: entry.brewer ?? null,
		grinds,
		pours: entry.pours
			? entry.pours.map(p => ({ water_g: p.water_g, time_s: p.time_s, notes: p.notes ?? null }))
			: null,
		notes: entry.notes ?? null
	};
}

export function toYamlShape(d) {
	const out = { bean: d.bean, roaster: d.roaster, method: d.method };
	if (d.method_name != null) out.method_name = d.method_name;
	if (d.dose_g != null) out.dose_g = d.dose_g;
	if (d.yield_g != null) out.yield_g = d.yield_g;
	if (d.water_g != null) out.water_g = d.water_g;
	if (d.time_s != null) out.time_s = maybeNumber(d.time_s);
	if (d.temperature_c != null) out.temperature_c = d.temperature_c;
	if (d.bloom_time_s != null) out.bloom_time_s = maybeNumber(d.bloom_time_s);
	if (d.total_time_s != null) out.total_time_s = maybeNumber(d.total_time_s);
	if (d.brewer != null) out.brewer = d.brewer;
	for (const grind of d.grinds ?? []) {
		out[grind.type ? `grind(${grind.type})` : 'grind'] = maybeNumber(grind.setting);
	}
	if (d.pours?.length) {
		out.pours = d.pours.map(p => {
			const pour = { water_g: p.water_g, time_s: p.time_s };
			if (p.notes != null) pour.notes = p.notes;
			return pour;
		});
	}
	if (d.notes != null) out.notes = d.notes;
	return out;
}
```

Note the round-trip subtlety: `toYamlShape` omits a pour's `notes` when null, and `fromYamlShape` restores it as `null` — that's what makes the round-trip test pass.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/dialin.js src/lib/server/dialin.test.js
git commit -m "feat: dialin yaml shape mapping

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Form parsing and validation (`parseDialinForm`)

**Files:**
- Modify: `src/lib/server/dialin.js` (append)
- Test: `src/lib/server/dialin.test.js` (append)

**Interfaces:**
- Consumes: global `FormData` (Node ≥ 18 provides it in tests).
- Produces: `parseDialinForm(formData: FormData): { ok: true, dialin } | { ok: false, errors: Record<string,string>, values: Record<string,string> }`
  - Field names it reads: `bean`, `roaster`, `method`, `method_name`, `dose_g`, `yield_g`, `time_s`, `water_g`, `temperature_c`, `bloom_time_s`, `total_time_s`, `brewer`, `notes`, and repeated `grind_type`/`grind_setting`, `pour_water`/`pour_time`/`pour_notes`. (Task 11's form must use exactly these names.)

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/server/dialin.test.js`:

```js
import { parseDialinForm } from './dialin.js';

function fd(fields, multi = {}) {
	const data = new FormData();
	for (const [k, v] of Object.entries(fields)) data.append(k, v);
	for (const [k, list] of Object.entries(multi)) for (const v of list) data.append(k, v);
	return data;
}

describe('parseDialinForm', () => {
	it('parses a complete espresso form', () => {
		const result = parseDialinForm(
			fd(
				{ bean: 'Forte', roaster: 'Jewel', method: 'espresso', dose_g: '18', yield_g: '35', time_s: '30', notes: 'Nice.' },
				{ grind_type: ['K6'], grind_setting: ['26'] }
			)
		);
		assert.equal(result.ok, true);
		assert.deepEqual(result.dialin, {
			bean: 'Forte', roaster: 'Jewel', method: 'espresso', method_name: null,
			dose_g: 18, yield_g: 35, time_s: '30',
			water_g: null, temperature_c: null, bloom_time_s: null, total_time_s: null, brewer: null,
			grinds: [{ type: 'K6', setting: '26' }], pours: null, notes: 'Nice.'
		});
	});

	it('requires bean, roaster, and a valid method', () => {
		const result = parseDialinForm(fd({ bean: ' ', roaster: '', method: 'siphon' }));
		assert.equal(result.ok, false);
		assert.ok(result.errors.bean);
		assert.ok(result.errors.roaster);
		assert.ok(result.errors.method);
	});

	it('rejects non-positive numbers and bad ranges', () => {
		const result = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso', dose_g: '-1', time_s: '30-' })
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.dose_g);
		assert.ok(result.errors.time_s);
	});

	it('accepts ranges with spaces and drops empty grind rows', () => {
		const result = parseDialinForm(
			fd(
				{ bean: 'X', roaster: 'Y', method: 'espresso', time_s: '25 - 26' },
				{ grind_type: ['', 'K6'], grind_setting: ['', '27'] }
			)
		);
		assert.equal(result.ok, true);
		assert.equal(result.dialin.time_s, '25 - 26');
		assert.deepEqual(result.dialin.grinds, [{ type: 'K6', setting: '27' }]);
	});

	it('flags a grind row with a type but no setting', () => {
		const result = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso' }, { grind_type: ['K6'], grind_setting: [''] })
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.grinds);
	});

	it('parses pour-over with pours; time 0 is allowed', () => {
		const result = parseDialinForm(
			fd(
				{
					bean: 'Ethiopia', roaster: 'SM', method: 'pourover', method_name: '4:6 Method',
					dose_g: '20', water_g: '300', temperature_c: '92', brewer: 'V60'
				},
				{ pour_water: ['60', '60'], pour_time: ['0', '45'], pour_notes: ['Bloom', ''] }
			)
		);
		assert.equal(result.ok, true);
		assert.deepEqual(result.dialin.pours, [
			{ water_g: 60, time_s: 0, notes: 'Bloom' },
			{ water_g: 60, time_s: 45, notes: null }
		]);
	});

	it('flags incomplete pour rows', () => {
		const result = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'pourover' }, { pour_water: ['60'], pour_time: [''], pour_notes: [''] })
		);
		assert.equal(result.ok, false);
		assert.ok(result.errors.pours);
	});

	it('nulls out cross-method fields', () => {
		const espresso = parseDialinForm(
			fd({ bean: 'X', roaster: 'Y', method: 'espresso', water_g: '300', brewer: 'V60', method_name: 'Z' })
		);
		assert.equal(espresso.ok, true);
		assert.equal(espresso.dialin.water_g, null);
		assert.equal(espresso.dialin.brewer, null);
		assert.equal(espresso.dialin.method_name, null);
		const pourover = parseDialinForm(fd({ bean: 'X', roaster: 'Y', method: 'pourover', yield_g: '35' }));
		assert.equal(pourover.ok, true);
		assert.equal(pourover.dialin.yield_g, null);
	});

	it('echoes raw values on failure', () => {
		const result = parseDialinForm(fd({ bean: '', roaster: 'Y', method: 'espresso', dose_g: '18' }));
		assert.equal(result.ok, false);
		assert.equal(result.values.roaster, 'Y');
		assert.equal(result.values.dose_g, '18');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `parseDialinForm` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/server/dialin.js`:

```js
const RANGE = /^\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?$/;
const ECHO_FIELDS = [
	'bean', 'roaster', 'method', 'method_name', 'dose_g', 'yield_g', 'time_s',
	'water_g', 'temperature_c', 'bloom_time_s', 'total_time_s', 'brewer', 'notes'
];

function field(formData, name) {
	const value = formData.get(name);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

export function parseDialinForm(formData) {
	const errors = {};

	const bean = field(formData, 'bean');
	const roaster = field(formData, 'roaster');
	const method = field(formData, 'method');
	if (!bean) errors.bean = 'Bean is required.';
	if (!roaster) errors.roaster = 'Roaster is required.';
	if (method !== 'espresso' && method !== 'pourover') errors.method = 'Pick espresso or pour over.';

	const numeric = (name, label) => {
		const raw = field(formData, name);
		if (raw === null) return null;
		const n = Number(raw);
		if (!Number.isFinite(n) || n <= 0) {
			errors[name] = `${label} must be a positive number.`;
			return null;
		}
		return n;
	};
	const rangeText = (name, label) => {
		const raw = field(formData, name);
		if (raw === null) return null;
		if (!RANGE.test(raw)) {
			errors[name] = `${label} must be a number or a range like 25-30.`;
			return null;
		}
		return raw;
	};

	const dose_g = numeric('dose_g', 'Dose');
	const yield_g = numeric('yield_g', 'Yield');
	const water_g = numeric('water_g', 'Water');
	const temperature_c = numeric('temperature_c', 'Temperature');
	const time_s = rangeText('time_s', 'Time');
	const bloom_time_s = rangeText('bloom_time_s', 'Bloom time');
	const total_time_s = rangeText('total_time_s', 'Total time');

	const grinds = [];
	const grindTypes = formData.getAll('grind_type').map(v => String(v).trim());
	const grindSettings = formData.getAll('grind_setting').map(v => String(v).trim());
	for (let i = 0; i < Math.max(grindTypes.length, grindSettings.length); i++) {
		const type = grindTypes[i] || null;
		const setting = grindSettings[i] || '';
		if (!type && !setting) continue;
		if (!setting || !RANGE.test(setting)) {
			errors.grinds = 'Every grind row needs a setting — a number or a range like 7-8.';
			continue;
		}
		grinds.push({ type, setting });
	}

	const pours = [];
	const pourWater = formData.getAll('pour_water').map(v => String(v).trim());
	const pourTime = formData.getAll('pour_time').map(v => String(v).trim());
	const pourNotes = formData.getAll('pour_notes').map(v => String(v).trim());
	for (let i = 0; i < Math.max(pourWater.length, pourTime.length, pourNotes.length); i++) {
		if (!pourWater[i] && !pourTime[i] && !pourNotes[i]) continue;
		const water = Number(pourWater[i]);
		const time = Number(pourTime[i]);
		const waterOk = pourWater[i] && Number.isFinite(water) && water > 0;
		const timeOk = pourTime[i] !== '' && pourTime[i] !== undefined && Number.isFinite(time) && time >= 0;
		if (!waterOk || !timeOk) {
			errors.pours = 'Every pour needs water (g) and time (s).';
			continue;
		}
		pours.push({ water_g: water, time_s: time, notes: pourNotes[i] || null });
	}

	if (Object.keys(errors).length > 0) {
		const values = {};
		for (const name of ECHO_FIELDS) values[name] = String(formData.get(name) ?? '');
		return { ok: false, errors, values };
	}

	return {
		ok: true,
		dialin: {
			bean,
			roaster,
			method,
			method_name: method === 'pourover' ? field(formData, 'method_name') : null,
			dose_g,
			yield_g: method === 'espresso' ? yield_g : null,
			time_s,
			water_g: method === 'pourover' ? water_g : null,
			temperature_c,
			bloom_time_s: method === 'pourover' ? bloom_time_s : null,
			total_time_s: method === 'pourover' ? total_time_s : null,
			brewer: method === 'pourover' ? field(formData, 'brewer') : null,
			grinds,
			pours: method === 'pourover' && pours.length > 0 ? pours : null,
			notes: field(formData, 'notes')
		}
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/dialin.js src/lib/server/dialin.test.js
git commit -m "feat: dialin form parsing and validation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `$lib` helpers consume `grinds` arrays

**Files:**
- Modify: `src/lib/index.js:41-50` (the `getGrinds` function)
- Test: `src/lib/grind.test.js` (full replacement)

**Interfaces:**
- Consumes: dialin objects with `grinds: [{ type, setting }]` (rows from the DB, Task 6+).
- Produces: `getGrinds(entry)` now returns `entry.grinds ?? []`. `formatRange`, `matchesQuery`, `getGrinderNames`, `filterEntries` keep their exact signatures — only the entry shape they accept changes.

- [ ] **Step 1: Replace the test file with grinds-array fixtures**

Replace `src/lib/grind.test.js` entirely with:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as lib from './index.js';

describe('formatRange', () => {
	it('replaces a hyphen between numbers with an en dash', () => {
		assert.equal(lib.formatRange('7-8'), '7–8');
		assert.equal(lib.formatRange('25 - 26'), '25–26');
	});

	it('leaves single values untouched', () => {
		assert.equal(lib.formatRange(28), '28');
		assert.equal(lib.formatRange('14'), '14');
	});
});

describe('matchesQuery', () => {
	const entry = {
		bean: 'Grizzly Claw',
		roaster: 'Kick Horse',
		notes: 'Dark roast with little bitterness.',
		grinds: [{ type: 'K6', setting: '28' }]
	};

	it('matches any field case-insensitively, including grinder names', () => {
		assert.equal(lib.matchesQuery(entry, 'grizzly'), true);
		assert.equal(lib.matchesQuery(entry, 'KICK'), true);
		assert.equal(lib.matchesQuery(entry, 'bitterness'), true);
		assert.equal(lib.matchesQuery(entry, 'k6'), true);
	});

	it('returns false when nothing matches', () => {
		assert.equal(lib.matchesQuery(entry, 'ethiopia'), false);
	});

	it('matches everything on an empty or blank query', () => {
		assert.equal(lib.matchesQuery(entry, ''), true);
		assert.equal(lib.matchesQuery(entry, '   '), true);
		assert.equal(lib.matchesQuery(entry, undefined), true);
	});
});

describe('getGrinderNames', () => {
	it('returns unique grinder names in first-seen order', () => {
		const entries = [
			{ grinds: [{ type: 'Breville', setting: '7' }, { type: 'K6', setting: '28' }] },
			{ grinds: [{ type: null, setting: '14' }] },
			{ grinds: [{ type: 'K6', setting: '30' }] }
		];
		assert.deepEqual(lib.getGrinderNames(entries), ['Breville', 'K6']);
	});

	it('returns an empty list when no entry names a grinder', () => {
		assert.deepEqual(lib.getGrinderNames([{ grinds: [{ type: null, setting: '7' }] }, { bean: 'X' }]), []);
	});
});

describe('filterEntries', () => {
	const entries = [
		{ bean: 'Espresso', roaster: 'Lavazza', method: 'espresso', grinds: [{ type: 'K6', setting: '28' }] },
		{ bean: 'Grizzly Claw', roaster: 'Kick Horse', method: 'espresso', grinds: [{ type: null, setting: '14' }] },
		{ bean: 'Colombia Huila', roaster: 'Onyx', method: 'pourover', grinds: [{ type: 'Breville', setting: '24' }] }
	];

	it('returns everything with no filters', () => {
		assert.deepEqual(lib.filterEntries(entries, {}), entries);
		assert.deepEqual(lib.filterEntries(entries), entries);
	});

	it('filters by method', () => {
		assert.deepEqual(
			lib.filterEntries(entries, { method: 'pourover' }).map(e => e.bean),
			['Colombia Huila']
		);
	});

	it('filters by grinder name', () => {
		assert.deepEqual(
			lib.filterEntries(entries, { grinder: 'K6' }).map(e => e.bean),
			['Espresso']
		);
	});

	it('combines query, method, and grinder filters', () => {
		assert.deepEqual(
			lib.filterEntries(entries, { query: 'lavazza', method: 'espresso', grinder: 'K6' }).map(e => e.bean),
			['Espresso']
		);
		assert.deepEqual(lib.filterEntries(entries, { query: 'lavazza', method: 'pourover' }), []);
	});
});

describe('getGrinds', () => {
	it('returns the grinds array as-is', () => {
		const grinds = [{ type: 'K6', setting: '27' }, { type: null, setting: '7-8' }];
		assert.deepEqual(lib.getGrinds({ grinds }), grinds);
	});

	it('returns an empty array when grinds is missing or null', () => {
		assert.deepEqual(lib.getGrinds({ bean: 'Espresso' }), []);
		assert.deepEqual(lib.getGrinds({ grinds: null }), []);
	});
});
```

- [ ] **Step 2: Run tests to verify the new expectations fail**

Run: `npm test`
Expected: FAIL — `getGrinds` still parses `grind(...)` keys, so the grinds-array fixtures return `[]`.

- [ ] **Step 3: Simplify `getGrinds`**

In `src/lib/index.js`, replace the entire `getGrinds` function (currently the `grind(...)`-key parser at the bottom of the file) with:

```js
export function getGrinds(entry) {
	return entry.grinds ?? [];
}
```

No other function in the file changes — `matchesQuery`, `getGrinderNames`, and `filterEntries` all go through `getGrinds`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/index.js src/lib/grind.test.js
git commit -m "refactor: helpers consume grinds arrays

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Database layer, schema, seed script

**Files:**
- Create: `db/schema.sql`
- Create: `src/lib/server/db.js`
- Create: `db/seed.js`

**Interfaces:**
- Consumes: `fromYamlShape` from `src/lib/server/dialin.js` (Task 3); `$env/dynamic/private` (app) / `process.env.DATABASE_URL` (seed).
- Produces:
  - `listDialins(): Promise<row[]>` — rows ordered `created_at DESC, id DESC`; numeric columns converted to JS numbers; each row also carries `id`, `created_at`, `updated_at`.
  - `createDialin(dialin): Promise<void>`, `updateDialin(id, dialin): Promise<void>` (bumps `updated_at`), `deleteDialin(id): Promise<void>`.
  - CLI: `node --env-file=.env db/seed.js <file.yaml> [--replace]`.
- No unit tests: `db.js` is a thin SQL wrapper around `$env` (not importable under plain `node --test`); all logic it consumes is already tested. It gets exercised for real in Task 7.

- [ ] **Step 1: Write the schema**

Create `db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS dialins (
	id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	bean          text NOT NULL,
	roaster       text NOT NULL,
	method        text NOT NULL CHECK (method IN ('espresso', 'pourover')),
	method_name   text,
	dose_g        numeric,
	yield_g       numeric,
	time_s        text,
	water_g       numeric,
	temperature_c numeric,
	bloom_time_s  text,
	total_time_s  text,
	brewer        text,
	grinds        jsonb NOT NULL DEFAULT '[]',
	pours         jsonb,
	notes         text,
	created_at    timestamptz NOT NULL DEFAULT now(),
	updated_at    timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write the DB module**

Create `src/lib/server/db.js`:

```js
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
	const rows = await sql()`SELECT * FROM dialins ORDER BY created_at DESC, id DESC`;
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
```

- [ ] **Step 3: Write the seed/restore script**

Create `db/seed.js`:

```js
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
```

- [ ] **Step 4: Sanity-check syntax and existing tests**

Run: `node --check db/seed.js && node --check src/lib/server/db.js && npm test`
Expected: both checks pass; test suite still green.

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql db/seed.js src/lib/server/db.js
git commit -m "feat: db layer, schema, and seed script

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Provision Vercel + Neon, apply schema, seed ⚠️ needs the user

**Files:** none committed (`.env` is created locally and stays gitignored).

**Interfaces:**
- Consumes: `db/schema.sql`, `db/seed.js` (Task 6).
- Produces: a Vercel project linked to the GitHub repo; Neon database with 11 seeded rows; `.env` containing `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`; the same three vars set in Vercel for Production/Preview/Development.

This task is dashboard + interactive-CLI work. The executor should hand these steps to the user (in Claude Code, interactive commands can be run by typing `! <command>` in the prompt).

- [ ] **Step 1 (user): Create the Vercel project**

In the Vercel dashboard: **Add New… → Project → Import** the `kohi` GitHub repo. Framework preset should auto-detect SvelteKit; leave build settings default; production branch `main`. (The first auto-deploy builds the *current* pushed code — it may look broken at the vercel.app URL until Task 13's push. That's expected and harmless; nothing points at it yet.)

- [ ] **Step 2 (user): Attach Neon**

Project → **Storage** tab → **Create Database → Neon (Postgres)** → accept defaults → **Connect** to the project for all environments. Then check Project → Settings → Environment Variables: confirm a Postgres connection string was injected. If it's named `DATABASE_URL`, done. If the integration named it differently (e.g. `POSTGRES_URL`), add a `DATABASE_URL` variable with the same value — the code reads `DATABASE_URL` only.

- [ ] **Step 3 (user): Set auth env vars**

Same Environment Variables screen — add for Production, Preview, and Development:
- `ADMIN_PASSWORD`: a long random password (32+ chars, from a password manager).
- `SESSION_SECRET`: a different long random string (32+ chars).

- [ ] **Step 4 (user): Link the repo locally and pull env**

```bash
npm i -g vercel
vercel login        # interactive — run as `! vercel login` in Claude Code
vercel link         # pick the kohi project
vercel env pull .env
```

Expected: `.env` exists at the repo root and contains `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`. Verify it is NOT staged: `git status` must not list `.env` (`.gitignore` already covers it).

- [ ] **Step 5 (user): Apply the schema**

Open the Neon console (Storage tab → the database → **Open in Neon** → SQL Editor), paste the contents of `db/schema.sql`, run it.
Expected: `CREATE TABLE` success. (Alternative if psql is installed: `psql "<DATABASE_URL>" -f db/schema.sql`.)

- [ ] **Step 6: Seed from the YAML file**

Run: `node --env-file=.env db/seed.js static/dialins.yaml`
Expected: `Seeded 11 entries from static/dialins.yaml.`

- [ ] **Step 7: Verify the guard and the count**

Run: `node --env-file=.env db/seed.js static/dialins.yaml`
Expected: exits non-zero with `Table already has 11 rows; pass --replace to truncate and reimport.` — this doubles as the row-count check.

---

### Task 8: Auth — hooks, login page, shared theme move

**Files:**
- Create: `src/hooks.server.js`
- Create: `src/routes/login/+page.server.js`
- Create: `src/routes/login/+page.svelte`
- Modify: `src/routes/+layout.svelte` (receives the global theme CSS)
- Modify: `src/routes/+page.svelte:307-343` (the `:global(:root)`, dark-mode, and `:global(body)` blocks move out)

**Interfaces:**
- Consumes: `verifySession`, `createSession`, `passwordMatches`, `SESSION_COOKIE`, `SESSION_TTL_MS` (Task 2); `$env/dynamic/private`.
- Produces: `event.locals.authed: boolean` on every request; `/login` route with a `login` action; the CSS custom properties available on every route (login page and error page included), not just `/`.

- [ ] **Step 1: Move the theme globals to the layout**

Cut these three blocks from `src/routes/+page.svelte`'s `<style>` — `:global(:root) { … }` (the `color-scheme`/custom-properties block), `@media (prefers-color-scheme: dark) { :global(:root) { … } }`, and `:global(body) { … }` — and paste them verbatim into a new `<style>` block at the bottom of `src/routes/+layout.svelte`. They apply site-wide; `/login` needs them.

- [ ] **Step 2: Create the hook**

Create `src/hooks.server.js`:

```js
import { env } from '$env/dynamic/private';
import { verifySession, SESSION_COOKIE } from '$lib/server/session.js';

export async function handle({ event, resolve }) {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.authed = Boolean(token && env.SESSION_SECRET && verifySession(token, env.SESSION_SECRET));
	return resolve(event);
}
```

- [ ] **Step 3: Create the login action**

Create `src/routes/login/+page.server.js`:

```js
import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_TTL_MS } from '$lib/server/session.js';

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
```

- [ ] **Step 4: Create the login page**

Create `src/routes/login/+page.svelte`:

```svelte
<script>
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Sign in · Kohi</title>
</svelte:head>

<main>
	<h1>Sign in</h1>
	<form method="POST" action="?/login" use:enhance>
		<label>
			Password
			<input type="password" name="password" required autocomplete="current-password" />
		</label>
		{#if form?.message}<p class="form-error" role="alert">{form.message}</p>{/if}
		<button>Sign in</button>
	</form>
	<a href="/">← Back to Kohi</a>
</main>

<style>
	main {
		max-width: 20rem;
		margin: 18vh auto 0;
		padding: 0 1.5rem;
		font-family: var(--sans);
	}

	h1 {
		font-family: var(--serif);
		font-size: 1.5rem;
		margin: 0 0 1.25rem;
	}

	label {
		display: block;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--ink-muted);
	}

	input {
		display: block;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.4rem;
		padding: 0.55rem 0.85rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font-size: 1rem;
	}

	input:focus {
		outline: none;
		border-color: var(--accent);
	}

	button {
		margin-top: 1rem;
		width: 100%;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 8px;
		background: var(--accent);
		color: var(--bg);
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.form-error {
		color: #b3382c;
		font-size: 0.85rem;
		margin: 0.75rem 0 0;
	}

	a {
		display: inline-block;
		margin-top: 1.5rem;
		font-size: 0.85rem;
		color: var(--ink-muted);
	}
</style>
```

- [ ] **Step 5: Verify in dev**

Run: `npm run dev` then in a browser:
1. `http://localhost:5173/login` renders with the site background/typography (theme move worked).
2. Wrong password → "Wrong password." after a noticeable ~half-second delay.
3. Correct password (from `.env`) → redirected to `/`; DevTools → Application → Cookies shows `kohi_session` (HttpOnly ✓).
4. Visiting `/login` again while signed in → immediately redirected to `/`.

(The home page still renders from the static YAML at this point — that flips in Task 9.)

- [ ] **Step 6: Run tests and build**

Run: `npm test && npm run build`
Expected: tests green; build exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/hooks.server.js src/routes/login src/routes/+layout.svelte src/routes/+page.svelte
git commit -m "feat: admin login with signed session cookie

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Server-rendered page from Postgres (+ error page)

**Files:**
- Create: `src/routes/+page.server.js` (load only — actions arrive in Task 10)
- Create: `src/routes/+error.svelte`
- Delete: `src/routes/+page.js`, `src/routes/+layout.js`, `static/dialins.yaml`
- Modify: `package.json` (js-yaml note — see Step 3)

**Interfaces:**
- Consumes: `listDialins` (Task 6); `locals.authed` (Task 8); helpers already accept `grinds` arrays (Task 5).
- Produces: `load({ locals }): Promise<{ dialins: row[], authed: boolean }>` — the shape `+page.svelte` receives as `data`.

- [ ] **Step 1: Create the server load**

Create `src/routes/+page.server.js`:

```js
import { listDialins } from '$lib/server/db.js';

export async function load({ locals }) {
	return { dialins: await listDialins(), authed: locals.authed };
}
```

- [ ] **Step 2: Delete the static data path**

```bash
git rm src/routes/+page.js src/routes/+layout.js static/dialins.yaml
```

(`+page.js` fetched the YAML; `+layout.js` forced prerendering — with it gone the route is SSR. `static/dialins.yaml` is already seeded into Neon (Task 7) and preserved in git history; `/export.yaml` (Task 12) becomes the backup format.)

- [ ] **Step 3: Create the error page**

Create `src/routes/+error.svelte`:

```svelte
<script>
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} · Kohi</title>
</svelte:head>

<main>
	<h1>{page.status}</h1>
	<p>{page.error?.message ?? 'Something went wrong.'}</p>
	<a href="/">← Back to Kohi</a>
</main>

<style>
	main {
		max-width: 24rem;
		margin: 22vh auto 0;
		padding: 0 1.5rem;
		text-align: center;
		font-family: var(--sans);
	}

	h1 {
		font-family: var(--serif);
		font-size: 2.5rem;
		margin: 0 0 0.5rem;
	}

	p {
		color: var(--ink-soft);
		margin: 0 0 1.5rem;
	}

	a {
		font-size: 0.85rem;
		color: var(--ink-muted);
	}
</style>
```

- [ ] **Step 4: Verify in dev against the real database**

Run: `npm run dev`, open `http://localhost:5173/`:
1. All 11 espresso cards render, same order as the old site (70/30 Blend first, Barista Beans last).
2. Search, method chips, and grinder chips (K6, Breville) still work — this proves the `grinds`-array refactor and DB rows agree.
3. Grind ranges still display with en dashes (Grizzly Claw `14–15`, Gran Crema Breville `7–8`).
4. Ratio values unchanged (e.g. Forte `1:1.9`) — numeric normalization works.

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: green + exit 0 (build no longer prerenders).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: server-render dialins from postgres

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Mutation actions (create / update / delete / logout)

**Files:**
- Modify: `src/routes/+page.server.js` (add `actions`)

**Interfaces:**
- Consumes: `parseDialinForm` (Task 4), `createDialin`/`updateDialin`/`deleteDialin` (Task 6), `SESSION_COOKIE` (Task 2), `locals.authed` (Task 8).
- Produces: form actions `?/create`, `?/update`, `?/delete`, `?/logout` on `/`. Success payloads `{ saved: true }` / `{ deleted: true }`; failures carry `{ message }` or `{ errors, values }` — exactly what `DialinForm.svelte` (Task 11) renders. `update`/`delete` read a numeric `id` field.

- [ ] **Step 1: Add the actions**

Replace `src/routes/+page.server.js` entirely with:

```js
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
		} catch {
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
		} catch {
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
		} catch {
			return fail(500, { message: 'Delete failed — try again.' });
		}
		return { deleted: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/');
	}
};
```

- [ ] **Step 2: Verify the auth gate with curl**

With `npm run dev` running (note: the `Origin` header is required — SvelteKit's CSRF check rejects the POST outright without it):

```bash
curl -s -o - -w "\nHTTP %{http_code}\n" -X POST "http://localhost:5173/?/create" \
  -H "Origin: http://localhost:5173" \
  --data "bean=Test&roaster=Test&method=espresso"
```

Expected: `HTTP 403` and a body containing `Your session has expired — sign in again.`

- [ ] **Step 3: Verify an authed create round-trip**

1. In the browser, sign in at `/login`.
2. DevTools → Application → Cookies → copy the `kohi_session` value.
3. Run (paste the cookie value):

```bash
curl -s -o - -w "\nHTTP %{http_code}\n" -X POST "http://localhost:5173/?/create" \
  -H "Origin: http://localhost:5173" \
  -H "Cookie: kohi_session=<PASTE_VALUE_HERE>" \
  --data "bean=Curl Test&roaster=Test Roaster&method=espresso&dose_g=18&yield_g=36&time_s=28&grind_type=K6&grind_setting=27"
```

Expected: `HTTP 200`, body contains `"saved":true`. Reload `/` in the browser: "Curl Test" appears at the TOP of the Espresso section (created_at DESC).

4. Clean up via the delete action (find the id: it's the newest, or check the Neon console — `SELECT id, bean FROM dialins ORDER BY created_at DESC LIMIT 1`):

```bash
curl -s -o - -w "\nHTTP %{http_code}\n" -X POST "http://localhost:5173/?/delete" \
  -H "Origin: http://localhost:5173" \
  -H "Cookie: kohi_session=<PASTE_VALUE_HERE>" \
  --data "id=<THE_ID>"
```

Expected: `HTTP 200`, `"deleted":true`, entry gone on reload.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: green + exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.server.js
git commit -m "feat: dialin mutation actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Drawer editing UI

**Files:**
- Create: `src/lib/components/DialinForm.svelte`
- Modify: `src/routes/+page.svelte` (script block, header, both card headers, after `</main>`, style block)

**Interfaces:**
- Consumes: `data.authed`, `data.dialins` (Task 9); actions and payload shapes (Task 10); field names from `parseDialinForm` (Task 4); `getGrinderNames` (Task 5).
- Produces: `<DialinForm bind:open dialin={entryOrNull} grinderNames={string[]} />` — `dialin === null` means "create".

- [ ] **Step 1: Create the drawer component**

Create `src/lib/components/DialinForm.svelte`:

```svelte
<script>
	import { enhance } from '$app/forms';

	let { open = $bindable(false), dialin = null, grinderNames = [] } = $props();

	let dialogEl = $state(null);
	let method = $state('espresso');
	let grindRows = $state([]);
	let pourRows = $state([]);
	let errors = $state({});
	let message = $state('');
	let generation = $state(0);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	// Re-initialize the form every time the drawer opens.
	$effect(() => {
		if (!open) return;
		method = dialin?.method ?? 'espresso';
		grindRows = dialin?.grinds?.length
			? dialin.grinds.map(g => ({ type: g.type ?? '', setting: g.setting }))
			: [{ type: '', setting: '' }];
		pourRows = dialin?.pours?.length
			? dialin.pours.map(p => ({ water_g: p.water_g, time_s: p.time_s, notes: p.notes ?? '' }))
			: [];
		errors = {};
		message = '';
		generation += 1;
	});

	function submitHandler() {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				open = false;
			} else if (result.type === 'failure') {
				errors = result.data?.errors ?? {};
				message = result.data?.message ?? '';
			}
			await update({ reset: false });
		};
	}

	function deleteHandler({ cancel }) {
		if (!confirm(`Delete "${dialin.bean}"?`)) {
			cancel();
			return;
		}
		return async ({ result, update }) => {
			if (result.type === 'success') open = false;
			else if (result.type === 'failure') message = result.data?.message ?? 'Delete failed.';
			await update();
		};
	}
</script>

<dialog bind:this={dialogEl} class="drawer" onclose={() => (open = false)}>
	{#key generation}
		<header class="drawer-header">
			<h2>{dialin ? `Edit: ${dialin.bean}` : 'New dial-in'}</h2>
			<button type="button" class="ghost close" aria-label="Close" onclick={() => (open = false)}>×</button>
		</header>

		{#if message}<p class="form-error banner" role="alert">{message}</p>{/if}

		<form method="POST" action={dialin ? '?/update' : '?/create'} use:enhance={submitHandler}>
			{#if dialin}<input type="hidden" name="id" value={dialin.id} />{/if}

			<label>
				Bean
				<input name="bean" required value={dialin?.bean ?? ''} />
				{#if errors.bean}<span class="form-error">{errors.bean}</span>{/if}
			</label>

			<label>
				Roaster
				<input name="roaster" required value={dialin?.roaster ?? ''} />
				{#if errors.roaster}<span class="form-error">{errors.roaster}</span>{/if}
			</label>

			<fieldset class="segmented">
				<legend>Method</legend>
				<label class:active={method === 'espresso'}>
					<input type="radio" name="method" value="espresso" bind:group={method} />
					Espresso
				</label>
				<label class:active={method === 'pourover'}>
					<input type="radio" name="method" value="pourover" bind:group={method} />
					Pour Over
				</label>
			</fieldset>

			<div class="grid2">
				<label>
					Dose (g)
					<input name="dose_g" type="number" step="0.1" min="0" value={dialin?.dose_g ?? ''} />
					{#if errors.dose_g}<span class="form-error">{errors.dose_g}</span>{/if}
				</label>
				<label>
					Temp (°C)
					<input name="temperature_c" type="number" step="0.5" min="0" value={dialin?.temperature_c ?? ''} />
					{#if errors.temperature_c}<span class="form-error">{errors.temperature_c}</span>{/if}
				</label>
			</div>

			{#if method === 'espresso'}
				<div class="grid2">
					<label>
						Yield (g)
						<input name="yield_g" type="number" step="0.1" min="0" value={dialin?.yield_g ?? ''} />
						{#if errors.yield_g}<span class="form-error">{errors.yield_g}</span>{/if}
					</label>
					<label>
						Time (s)
						<input name="time_s" placeholder="28 or 28-32" value={dialin?.time_s ?? ''} />
						{#if errors.time_s}<span class="form-error">{errors.time_s}</span>{/if}
					</label>
				</div>
			{:else}
				<label>
					Method name
					<input name="method_name" placeholder="4:6 Method" value={dialin?.method_name ?? ''} />
				</label>
				<div class="grid2">
					<label>
						Water (g)
						<input name="water_g" type="number" step="1" min="0" value={dialin?.water_g ?? ''} />
						{#if errors.water_g}<span class="form-error">{errors.water_g}</span>{/if}
					</label>
					<label>
						Brewer
						<input name="brewer" placeholder="V60" value={dialin?.brewer ?? ''} />
					</label>
				</div>
				<div class="grid2">
					<label>
						Bloom (s)
						<input name="bloom_time_s" placeholder="45" value={dialin?.bloom_time_s ?? ''} />
						{#if errors.bloom_time_s}<span class="form-error">{errors.bloom_time_s}</span>{/if}
					</label>
					<label>
						Total time (s)
						<input name="total_time_s" placeholder="210" value={dialin?.total_time_s ?? ''} />
						{#if errors.total_time_s}<span class="form-error">{errors.total_time_s}</span>{/if}
					</label>
				</div>

				<fieldset class="rows">
					<legend>Pour schedule</legend>
					{#each pourRows as row, i (i)}
						<div class="row pour-row">
							<input name="pour_water" type="number" step="1" min="0" placeholder="g" bind:value={row.water_g} aria-label="Pour {i + 1} water (g)" />
							<input name="pour_time" type="number" step="1" min="0" placeholder="@ s" bind:value={row.time_s} aria-label="Pour {i + 1} time (s)" />
							<input name="pour_notes" placeholder="note" bind:value={row.notes} aria-label="Pour {i + 1} note" />
							<button type="button" class="ghost" aria-label="Remove pour {i + 1}" onclick={() => pourRows.splice(i, 1)}>−</button>
						</div>
					{/each}
					<button type="button" class="ghost add-row" onclick={() => pourRows.push({ water_g: '', time_s: '', notes: '' })}>+ Pour</button>
					{#if errors.pours}<span class="form-error">{errors.pours}</span>{/if}
				</fieldset>
			{/if}

			<fieldset class="rows">
				<legend>Grinds</legend>
				<datalist id="grinder-names">
					{#each grinderNames as name}<option value={name}></option>{/each}
				</datalist>
				{#each grindRows as row, i (i)}
					<div class="row grind-row">
						<input name="grind_type" list="grinder-names" placeholder="Grinder (optional)" bind:value={row.type} aria-label="Grind {i + 1} grinder" />
						<input name="grind_setting" placeholder="27 or 7-8" bind:value={row.setting} aria-label="Grind {i + 1} setting" />
						<button type="button" class="ghost" aria-label="Remove grind {i + 1}" onclick={() => grindRows.splice(i, 1)}>−</button>
					</div>
				{/each}
				<button type="button" class="ghost add-row" onclick={() => grindRows.push({ type: '', setting: '' })}>+ Grinder</button>
				{#if errors.grinds}<span class="form-error">{errors.grinds}</span>{/if}
			</fieldset>

			<label>
				Notes
				<textarea name="notes" rows="3">{dialin?.notes ?? ''}</textarea>
			</label>

			<footer class="drawer-actions">
				<button type="button" class="ghost" onclick={() => (open = false)}>Cancel</button>
				<button class="primary">Save</button>
			</footer>
		</form>

		{#if dialin}
			<form method="POST" action="?/delete" use:enhance={deleteHandler} class="delete-form">
				<input type="hidden" name="id" value={dialin.id} />
				<button class="danger">Delete this dial-in</button>
			</form>
		{/if}
	{/key}
</dialog>

<style>
	.drawer {
		position: fixed;
		inset: 0 0 0 auto;
		margin: 0;
		height: 100dvh;
		max-height: 100dvh;
		width: min(26rem, 100vw);
		max-width: 100vw;
		border: none;
		border-left: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		padding: 1.5rem;
		overflow-y: auto;
		font-family: var(--sans);
	}

	.drawer::backdrop {
		background: rgba(0, 0, 0, 0.35);
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.drawer-header h2 {
		font-family: var(--serif);
		font-size: 1.2rem;
		margin: 0;
	}

	form > label,
	.grid2 {
		display: block;
		margin-bottom: 0.9rem;
	}

	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--ink-muted);
	}

	input,
	textarea {
		display: block;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.3rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--sans);
		font-size: 0.95rem;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	fieldset {
		border: 1px solid var(--line-soft);
		border-radius: 8px;
		padding: 0.75rem;
		margin: 0 0 0.9rem;
	}

	legend {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--ink-muted);
		padding: 0 0.3rem;
	}

	.segmented {
		display: flex;
		gap: 0.4rem;
	}

	.segmented label {
		flex: 1;
		text-align: center;
		padding: 0.45rem 0;
		border: 1px solid var(--line);
		border-radius: 999px;
		cursor: pointer;
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.segmented label.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, var(--surface));
		color: var(--accent);
	}

	.segmented input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.row {
		display: grid;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
		align-items: center;
	}

	.grind-row {
		grid-template-columns: 1fr 1fr auto;
	}

	.pour-row {
		grid-template-columns: 1fr 1fr 1.4fr auto;
	}

	.row input {
		margin-top: 0;
	}

	button {
		font-family: var(--sans);
		cursor: pointer;
	}

	.ghost {
		background: none;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: var(--ink-soft);
		padding: 0.35rem 0.7rem;
		font-size: 0.85rem;
	}

	.ghost:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.close {
		border: none;
		font-size: 1.3rem;
		line-height: 1;
		padding: 0.2rem 0.5rem;
	}

	.add-row {
		margin-top: 0.2rem;
	}

	.drawer-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1.25rem;
	}

	.primary {
		background: var(--accent);
		color: var(--bg);
		border: none;
		border-radius: 8px;
		padding: 0.55rem 1.3rem;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.delete-form {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
		text-align: center;
	}

	.danger {
		background: none;
		border: none;
		color: #b3382c;
		font-size: 0.85rem;
	}

	.form-error {
		display: block;
		color: #b3382c;
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: normal;
		margin-top: 0.3rem;
	}

	.banner {
		border: 1px solid color-mix(in srgb, #b3382c 40%, var(--line));
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		margin: 0 0 1rem;
	}

	@media (max-width: 520px) {
		.drawer {
			inset: auto 0 0 0;
			width: 100%;
			height: auto;
			max-height: 88dvh;
			border-left: none;
			border-top: 1px solid var(--line);
			border-radius: 14px 14px 0 0;
		}
	}
</style>
```

- [ ] **Step 2: Wire the page**

In `src/routes/+page.svelte`, make these five edits:

**(a)** Top of the `<script>` block — extend the imports and add drawer state:

```js
import { getGrinds, formatRange, filterEntries, getGrinderNames } from '$lib';
import { enhance } from '$app/forms';
import DialinForm from '$lib/components/DialinForm.svelte';

let { data } = $props();

let drawerOpen = $state(false);
let editing = $state(null);

function openNew() {
	editing = null;
	drawerOpen = true;
}

function openEdit(entry) {
	editing = entry;
	drawerOpen = true;
}
```

(`let { data } = $props();` already exists — don't duplicate it; add the rest around it.)

**(b)** In the header, immediately after the `<input class="search" … />` element, add:

```svelte
{#if data.authed}
	<button class="chip add-chip" onclick={openNew}>+ Add</button>
{/if}
```

**(c)** In the **espresso** card markup, inside `<div class="card-header">`, right after the closing `</div>` of `card-title`, add:

```svelte
{#if data.authed}
	<button class="edit-btn" aria-label="Edit {entry.bean}" onclick={() => openEdit(entry)}>✎</button>
{/if}
```

**(d)** Same addition in the **pour-over** card's `card-header`, after the `method_name` badge block (so the pencil sits last).

**(e)** Immediately after the closing `</main>` tag, add:

```svelte
<footer class="site-footer">
	{#if data.authed}
		<form method="POST" action="?/logout" use:enhance>
			<button class="footer-link">Sign out</button>
		</form>
	{:else}
		<a class="footer-link" href="/login">Sign in</a>
	{/if}
</footer>

<DialinForm bind:open={drawerOpen} dialin={editing} grinderNames={grinderNames} />
```

And append to the `<style>` block:

```css
.add-chip {
	border-color: var(--accent);
	color: var(--accent);
}

.edit-btn {
	flex-shrink: 0;
	background: none;
	border: 1px solid var(--line);
	border-radius: 8px;
	color: var(--ink-muted);
	font-size: 0.9rem;
	line-height: 1;
	padding: 0.35rem 0.5rem;
	cursor: pointer;
}

.edit-btn:hover {
	border-color: var(--accent);
	color: var(--accent);
}

.site-footer {
	max-width: 680px;
	margin: 0 auto;
	padding: 0 1.5rem 2.5rem;
	text-align: center;
}

.footer-link {
	background: none;
	border: none;
	padding: 0;
	font-family: var(--sans);
	font-size: 0.78rem;
	color: var(--ink-muted);
	text-decoration: none;
	cursor: pointer;
}

.footer-link:hover {
	color: var(--accent);
}
```

- [ ] **Step 3: Full manual smoke (dev, browser)**

With `npm run dev`:
1. Signed out: no pencils, no "+ Add", footer shows "Sign in".
2. Sign in → pencils + "+ Add" + "Sign out" appear.
3. **Add espresso**: + Add → fill Bean/Roaster/Dose 18/Yield 36/Time 28, grinder K6 setting 27 → Save → drawer closes, card appears at top of Espresso with ratio 1:2.0.
4. **Validation**: + Add → leave Bean empty, Time "abc" → Save → drawer stays open, inline errors under Bean and Time.
5. **Edit**: pencil on the new card → change Yield to 40 → Save → card updates.
6. **Add pour-over**: + Add → switch to Pour Over → fill method name "4:6 Method", water 300, brewer V60, two pours (60g @ 0 "Bloom", 240g @ 45) → Save → a "Pour Over" section appears with the pour-schedule timeline, and a "Pour Over" method chip appears in the header.
7. **Delete**: open both test entries → Delete → confirm → cards gone; Pour Over section disappears with its last entry.
8. **Esc / Cancel** close the drawer without saving.
9. Sign out → editing affordances vanish; direct curl POST still 403s (Task 10 Step 2 command).

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: green + exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/DialinForm.svelte src/routes/+page.svelte
git commit -m "feat: drawer editing ui

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: YAML export endpoint

**Files:**
- Create: `src/routes/export.yaml/+server.js`

**Interfaces:**
- Consumes: `listDialins` (Task 6), `toYamlShape` (Task 3), `js-yaml`.
- Produces: public `GET /export.yaml` → `text/yaml` document in the original `dialins.yaml` conventions, newest first; accepted verbatim by `db/seed.js`.

- [ ] **Step 1: Create the endpoint**

Create `src/routes/export.yaml/+server.js`:

```js
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
```

- [ ] **Step 2: Verify the output format**

With `npm run dev`:

```bash
curl -s http://localhost:5173/export.yaml
```

Expected: YAML list, first entry `bean: 70/30 Blend` with `grind(K6): 27`, Grizzly Claw entry has plain `grind: 14-15` — same conventions as the committed `static/dialins.yaml` had (key order within an entry may differ; that's fine).

- [ ] **Step 3: Verify the restore drill (round-trip through the seed script)**

```bash
curl -s http://localhost:5173/export.yaml -o kohi-export.tmp.yaml
node --env-file=.env db/seed.js kohi-export.tmp.yaml
```

Expected: the seed script *refuses* with `Table already has 11 rows; pass --replace to truncate and reimport.` — which proves the export parsed cleanly as seed input (a parse failure would error differently). Do NOT run `--replace` here (it would rewrite created_at timestamps for no reason). Delete the temp file: `rm kohi-export.tmp.yaml`.

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: green + exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/routes/export.yaml
git commit -m "feat: yaml export endpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Deploy and production smoke test

**Files:** none (push + verify).

**Interfaces:**
- Consumes: everything above; the Vercel project from Task 7.
- Produces: the live production site on `<project>.vercel.app`.

- [ ] **Step 1: Push**

Run: `git push origin main`
Expected: Vercel picks up the push and builds (watch the dashboard → Deployments). Build succeeds.

- [ ] **Step 2: Production smoke test (browser, on the vercel.app URL)**

1. Public view: all 11 entries, correct order, search + chips work, dark mode follows system, no asset 404s in the console, no `/kohi/...` requests in the Network tab.
2. `/login` → sign in → add a test entry → edit it → delete it (full Task 11 Step 3 pass, abbreviated).
3. `/export.yaml` downloads valid YAML including any current entries.
4. Signed-out browser (private window): no edit affordances; POST-without-session rejected (repeat Task 10 Step 2 curl against the prod URL with `Origin: https://<project>.vercel.app`).
5. PWA/offline: load the site, then DevTools → Network → Offline → reload → the last-viewed page still renders with data. Re-enable network.
6. Install prompt / manifest: DevTools → Application → Manifest shows start_url `/`, no warnings.

- [ ] **Step 3: Save a first backup**

Download `https://<project>.vercel.app/export.yaml` and keep it somewhere safe (it is the restore artifact for `db/seed.js --replace`). Optionally commit it under `db/backups/2026-MM-DD.yaml` — owner's call; not required.

---

### Task 14: Decommission GitHub Pages ⚠️ needs the user

**Files:** none in this repo's main branch.

Only after Task 13's smoke test passes — this is the point of no return for the old URL.

- [ ] **Step 1 (user): Delete the gh-pages branch**

```bash
git push origin --delete gh-pages
```

- [ ] **Step 2 (user): Disable Pages**

GitHub repo → Settings → Pages → set Source to "None" (or via CLI: `gh api -X DELETE "repos/{owner}/kohi/pages"`).
Expected: `https://<owner>.github.io/kohi/` stops serving (404). Optional alternative: before deleting, push a single `index.html` with `<meta http-equiv="refresh" content="0; url=https://<project>.vercel.app/">` to gh-pages instead, if you want the old URL to forward.

- [ ] **Step 3: Confirm done-state**

- Old URL 404s (or redirects, if you chose the stub).
- Vercel URL serves the site; editing works; `npm test` green on main.
- All spec §12 success criteria checked off.

---

## Post-plan notes for the executor

- If a `vite build` warning appears about `js-yaml` being CJS, it's benign — Vite pre-bundles it; the build must still exit 0.
- If Vercel's build uses a Node version without `Object.hasOwn`-era features, don't polyfill — set the project's Node version to 22.x in Vercel Settings → General instead. Default is already ≥ 22 for new projects.
- Preview deployments share the production `DATABASE_URL` by design (spec §9) — don't "fix" that.
- Never log `ADMIN_PASSWORD`, `SESSION_SECRET`, or `DATABASE_URL` values in command output; `.env` must never be committed.
