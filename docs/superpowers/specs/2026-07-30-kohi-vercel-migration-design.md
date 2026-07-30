# Kohi: GitHub Pages → Vercel migration with DB-backed, editable dial-ins

- **Date:** 2026-07-30
- **Status:** Approved
- **Scope:** Move hosting from GitHub Pages to Vercel, move dial-in data from `static/dialins.yaml` into Neon Postgres, and add password-gated in-app editing (add / edit / delete, espresso and pour-over).

This supersedes the earlier decision to keep data changes as manual YAML edits — reversed at the owner's request on 2026-07-30.

## 1. Goals

1. Site hosted on Vercel (git-integration deploys from `main`), served at the domain root.
2. Dial-ins stored in Neon Postgres; the site reads them server-side.
3. Single admin login (password) gating all mutations; public read view stays identical to today.
4. Drawer-based editing UI supporting both espresso and pour-over entries, including pour schedules.
5. `GET /export.yaml` backup endpoint producing the original YAML format; seed script doubles as restore.
6. GitHub Pages deployment retired cleanly, only after the Vercel deployment is verified.

## 2. Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Hosting | Vercel, git integration, production branch `main` |
| Database | Neon Postgres via the Vercel Marketplace integration |
| Auth | Single `ADMIN_PASSWORD` env var + HMAC-signed httpOnly session cookie (no accounts, no auth library) |
| Editing UX | Drawer/modal opened from a pencil button per card + "+ Add" in the header; public layout untouched |
| History | `created_at` / `updated_at` timestamps only; no revision log. YAML export serves as occasional backup |
| Pour-over | Fully supported in the form from day one, including the pour-schedule builder |
| Rendering | SSR: `+page.server.js` load + form actions (no JSON API layer, no static shell) |

## 3. Architecture

SvelteKit 2 + Svelte 5 stay. Changes:

- `@sveltejs/adapter-vercel` replaces `adapter-static`; the unused `adapter-auto` is dropped. Default Node.js runtime.
- `paths.base: '/kohi'` removed from `svelte.config.js`.
- `src/routes/+layout.js` (`prerender = true`) and `src/routes/+page.js` (client-side YAML fetch) are deleted. The page becomes server-rendered.

New files:

| File | Purpose |
|---|---|
| `src/routes/+page.server.js` | `load`: SELECT all dial-ins ordered `created_at DESC`, returns `{ dialins, authed }`. Actions: `create`, `update`, `delete`, `logout` |
| `src/routes/login/+page.svelte` + `+page.server.js` | Password form; `login` action sets the session cookie; redirects home if already authed |
| `src/routes/export.yaml/+server.js` | Public GET; serializes the DB to the original YAML format |
| `src/hooks.server.js` | Verifies the session cookie each request → `event.locals.authed` |
| `src/lib/server/db.js` | Neon client (`@neondatabase/serverless`) + query helpers; normalizes driver output (Postgres `numeric` comes back as strings → numbers) |
| `src/lib/server/session.js` | Pure sign/verify of the cookie value (HMAC-SHA256 via `node:crypto`; secret and clock injected for testability) |
| `src/lib/server/dialin.js` | Pure: FormData → row shape parsing, validation, row → YAML-shaped object mapping (for export) |
| `src/lib/components/DialinForm.svelte` | The add/edit drawer (native `<dialog>`) |
| `src/routes/+error.svelte` | Minimal friendly error page (e.g. DB unreachable) |
| `db/schema.sql` | Table definition |
| `db/seed.js` | Import of a `dialins.yaml`-format file. Refuses to run against a non-empty table unless `--replace` is passed (truncate + reimport) — plain run is the one-time seed, `--replace` is the restore path |

Modified files:

- `src/lib/index.js` + `src/lib/grind.test.js` — helpers consume the explicit `grinds` array instead of parsing `grind(...)` keys (that parsing moves into the seed script).
- `src/routes/+layout.svelte` — receives the `:root`/`body` theme-token CSS blocks from `+page.svelte` verbatim, so `/login` and the error page share the site theme (values unchanged).
- `src/routes/+page.svelte` — authed-only affordances (pencil per card, "+ Add"), drawer wiring, footer sign-in/out link.
- `static/manifest.webmanifest` — `start_url` and `scope`: `/kohi/` → `/`.
- `package.json` — deps: − `webpack`, − `webpack-cli`, − `@sveltejs/adapter-static`, − `@sveltejs/adapter-auto`; + `@sveltejs/adapter-vercel`, + `@neondatabase/serverless`; `js-yaml` stays (export endpoint + seed). Scripts: add `"test": "node --test src/"`.

Deleted: `static/dialins.yaml` (after seeding), `.github/workflows/build-and-deploy.yaml` (at decommission time).

Unchanged: `src/service-worker.js`, `src/app.html`, all styling values (design tokens, card CSS), PWA icons.

Data flow — read: request → hooks (cookie → `locals.authed`) → `load` → Neon → server-rendered HTML.
Data flow — write: drawer `<form>` POST `?/create|update|delete` → action (auth check → validate → SQL) → load re-runs → drawer closes.

Env vars (private, via `$env/dynamic/private`): `DATABASE_URL` (injected by the Vercel↔Neon integration), `ADMIN_PASSWORD`, `SESSION_SECRET`. Local dev uses a gitignored `.env` (SvelteKit loads it in dev); `vercel env pull .env` keeps it in sync.

## 4. Data model

```sql
CREATE TABLE dialins (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bean          text NOT NULL,
  roaster       text NOT NULL,
  method        text NOT NULL CHECK (method IN ('espresso','pourover')),
  method_name   text,             -- e.g. "4:6 Method"
  dose_g        numeric,
  yield_g       numeric,          -- espresso
  time_s        text,             -- text: allows ranges like "28-32"
  water_g       numeric,          -- pourover fields ↓
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

- `grinds`: ordered array of `{ "type": string|null, "setting": string }`. The YAML `grind(K6): 27` convention becomes `{"type":"K6","setting":"27"}`; legacy untyped `grind: 14-15` becomes `{"type":null,"setting":"14-15"}`.
- `pours`: array of `{ "water_g": number, "time_s": number, "notes": string|null }`, or NULL when absent.
- Fields that appear as ranges in real data (`time_s`, `bloom_time_s`, `total_time_s`, grind settings) are text validated as `NUM` or `NUM-NUM`. Genuinely numeric fields (dose, yield, water, temperature) are `numeric` so ratio math stays clean; the db module converts the driver's string representation back to JS numbers.
- Ordering: `created_at DESC` — new entries appear at the top of their method section, matching today's newest-first file order. The seed script staggers `created_at` in reverse file order to preserve the current display order exactly.
- The two commented-out pour-over entries in `dialins.yaml` are illustrative examples, not real brews. They are **not** seeded; real pour-overs get added through the form.

## 5. Auth

- **Login:** `/login` has a single password field. The action compares input against `ADMIN_PASSWORD` timing-safely (SHA-256 both sides → `crypto.timingSafeEqual`), sleeps ~500 ms on failure, and on success sets the cookie and redirects to `/`.
- **Cookie:** `kohi_session` = `<expiresAtMs>.<base64url HMAC-SHA256(expiresAtMs, SESSION_SECRET)>`; httpOnly, Secure, SameSite=Lax, Path=/, 30-day expiry. Stateless — no session table.
- **Verification:** `hooks.server.js` checks signature + expiry → `locals.authed`. Every mutating action independently rejects with 403 when `!locals.authed` (defense in depth; the load merely passes `authed` to the UI).
- **Logout:** action clears the cookie. Footer shows a quiet "Sign in" link, or "Sign out" when authed.
- **CSRF:** SvelteKit's built-in origin check for form actions + SameSite=Lax.
- **Accepted risk:** no rate-limiting infrastructure (stateless serverless makes it awkward). Timing-safe compare + failure delay + a long random password is the appropriate posture for a personal coffee log.

## 6. Editing UX

- When authed, each card gains a small pencil button (top-right of the card header) and the site header gains "+ Add" beside the search box.
- One reusable drawer, `DialinForm.svelte`, handles add and edit (edit pre-fills; hidden `id`). Native `<dialog>`/`showModal()` for focus trap + Esc; styled with the existing design tokens as a right-hand drawer on desktop, bottom sheet on mobile.
- Fields:
  - Always: **Bean** (required), **Roaster** (required), **Method** segmented control (Espresso | Pour Over) toggling the groups below, **Grinds** (repeatable rows: grinder name with a datalist of known names + setting; add/remove), **Notes** (textarea).
  - Espresso: dose (g), yield (g), time (s, range allowed).
  - Pour-over: method name, water (g), temperature (°C), bloom time (s), total time (s), brewer, and **Pours** — optional repeatable rows of water (g) / time (s) / note with add/remove.
- Real `<form>`s posting to `?/create`, `?/update`, `?/delete`, progressively enhanced with `use:enhance`. Repeatable rows post as parallel arrays (e.g. `grind_type[]` / `grind_setting[]`) and are parsed server-side into the JSONB shapes. Delete asks for JS `confirm()` before submitting.
- On success: page data invalidates (load re-runs), the drawer closes, `updated_at` bumps via `now()`.

## 7. Validation & error handling

Server-side validation is the source of truth:

- Required: `bean`, `roaster`, `method ∈ {espresso, pourover}`. Everything else optional — the cards already render absent fields as absent.
- When present: numeric fields must be finite positive numbers; range-able text fields must match `^\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?$`; each pour row needs numeric water + time (note optional). Fully empty grind/pour rows are dropped silently.
- Validation failure → `fail(400, { errors, values })`: the drawer stays open, shows inline errors, inputs keep their values.
- Action-time DB failure → `fail(500)` rendered as a banner in the drawer. Load-time DB failure → `+error.svelte`.
- Mutation without a valid session (e.g. cookie expired mid-edit) → `fail(403)` with a "sign in again" link.

## 8. PWA / offline

`src/service-worker.js` requires **no changes**:

- `dialins.yaml` no longer exists, so it drops out of the precache list (`files`) naturally; with no prerendered pages, `prerendered` is empty.
- `/` is handled by the existing network-first-with-cache-fallback branch: every successful GET refreshes the cache, so offline serves the last-viewed page including its data. The offline navigation fallback (`cache.match(base + '/')`) resolves to `/` once the base path is gone.
- Non-GET requests (all form actions) already bypass the service worker.

`manifest.webmanifest` is the only PWA change (`start_url`/`scope` → `/`). Editing requires network; offline stays read-only-last-seen. Behavior parity: today's site is also read-only offline.

## 9. Migration & cutover plan

Order matters — GitHub Pages stays live until Vercel is verified:

1. **Provision:** Import the repo as a Vercel project (SvelteKit preset auto-detected). Add Neon from the Vercel Storage/Marketplace tab (`DATABASE_URL` auto-injected). Set `ADMIN_PASSWORD` and `SESSION_SECRET` (e.g. `openssl rand -base64 32`) for prod/preview/dev.
2. **Local env:** `vercel env pull .env` (gitignored).
3. **Schema:** run `db/schema.sql` against Neon (SQL console or psql).
4. **Seed:** `node db/seed.js static/dialins.yaml` → verify 11 rows, order preserved.
5. **Implement** the code changes; `npm test`; `npm run dev` against Neon; manual smoke: visual parity with the live site, login, create/edit/delete for both methods (incl. pour schedules), `/export.yaml` round-trips through the seed parser.
6. **Deploy:** push to `main`; Vercel builds; smoke-test production the same way.
7. **Decommission Pages:** delete `.github/workflows/build-and-deploy.yaml`, delete the `gh-pages` branch, disable Pages in repo settings. Optional courtesy: instead of deleting outright, leave a final `gh-pages` commit containing a meta-refresh redirect to the Vercel URL (the old `*.github.io/kohi` URL otherwise 404s).
8. **Rollback story:** until step 7 the old site still works. Data restore = `node db/seed.js <exported file> --replace` using any `/export.yaml` snapshot.

Preview deployments share the production database (single-owner project; not worth DB-branch-per-preview complexity).

## 10. Testing

- `npm test` → `node --test src/` (built-in runner, already the style used by `grind.test.js`; no new test dependency).
- Updated: `src/lib/grind.test.js` for the `grinds`-array helper shapes.
- New pure-unit tests (no SvelteKit runtime needed):
  - `session.test.js` — sign/verify round-trip, tampered signature, expiry (injected clock).
  - `dialin.test.js` — FormData parsing (parallel arrays → JSONB shapes, empty-row dropping), validation matrix (required fields, range pattern, pour rows), row → YAML-shape mapping including `grind(K6)` key reconstruction, and an export → seed-parse round-trip check.
- Manual smoke checklist lives in §9. No component or e2e tests (out of scope).

## 11. Out of scope

Revision history; multi-user / roles / OAuth; rate-limiting infrastructure; custom domain; preview-deploy DB branching; ORM; image uploads; brew timers; ISR / edge runtime; any redesign of the public UI.

## 12. Success criteria

1. Site live on Vercel at the domain root; public view visually identical to today.
2. Login with the admin password; add/edit/delete espresso and pour-over entries (incl. pour schedules) from the drawer; changes persist across deploys.
3. New entries appear at the top of their section; seeded order matches the current site.
4. `/export.yaml` returns the data in the original YAML format and round-trips through `db/seed.js`.
5. Offline: previously-viewed site still renders with last-seen data.
6. `npm test` passes; no secrets in the repo; GitHub Pages workflow and branch removed.
