# Kohi Design-Review Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all changes from the 2026-08-03 UI/UX design review: recency stamps + sort, compact table view, sticky-header fixes, WCAG contrast/focus fixes, drawer safety & clarity, filter/empty-state feedback, brand mark, and small polish.

**Architecture:** All changes are presentational/interaction-level inside the existing SvelteKit app — `+layout.svelte` (design tokens), `+page.svelte` (list page), `DialinForm.svelte` (editor drawer), `login/+page.svelte`, `+error.svelte`, plus one ORDER BY change in `src/lib/server/db.js` and one new pure helper in `src/lib/index.js`. No schema or route changes.

**Tech Stack:** Svelte 5 (runes), SvelteKit 2, adapter-vercel, Neon serverless Postgres, `node --test` with AST-based component tests (`svelte/compiler` parse).

## Global Constraints

- Commits: conventional style (`feat:`/`fix:`), **NO Co-Authored-By trailers** (user convention for this repo).
- `DialinForm.test.js` compiles the component and asserts **zero Svelte warnings** — keep it warning-free.
- AST tests use *first rule matching class* semantics: new `.site-header.scrolled` / `.drawer`-related rules must come **after** the existing base rules inside the same block, or tests read the wrong rule.
- Existing declarations asserted by tests must keep exact values (e.g. `.drawer:not([open]) { display: none }`, phone `.row-field input { margin-top: 0.3rem }`, phone `.auth-chip { min-height: 44px }`).
- All new colors must pass WCAG AA (≥4.5:1) verified with the contrast script; motion wrapped in `@media (prefers-reduced-motion: no-preference)`.
- Run `npm test` after every task; visual verification (dev server + Puppeteer screenshots, light+dark, desktop+375px mobile) before declaring done.

---

### Task 1: Recency — relative-time helper, sort by last update, card stamps

**Files:**
- Modify: `src/lib/index.js` (add `formatRelativeDate`)
- Create: `src/lib/time.test.js`
- Modify: `src/lib/server/db.js:23` (`ORDER BY updated_at DESC, id DESC`)
- Modify: `src/routes/+page.svelte` (card footer stamp)

**Interfaces:**
- Produces: `formatRelativeDate(value, now = new Date()) -> string` — accepts Date or ISO string; returns `'today' | 'yesterday' | '3d ago' | '5w ago' | '12 Jun' | 'Jun 2025'`. Deterministic (own month array, no locale API — avoids SSR/client hydration text mismatch).

- [ ] Step 1: Write failing tests in `src/lib/time.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRelativeDate } from './index.js';

const now = new Date('2026-08-03T12:00:00Z');

test('same day is today', () => {
	assert.equal(formatRelativeDate(new Date('2026-08-03T01:00:00Z'), now), 'today');
});
test('previous day is yesterday', () => {
	assert.equal(formatRelativeDate('2026-08-02T23:00:00Z', now), 'yesterday');
});
test('under a week is days ago', () => {
	assert.equal(formatRelativeDate('2026-07-31T12:00:00Z', now), '3d ago');
});
test('under eight weeks is weeks ago', () => {
	assert.equal(formatRelativeDate('2026-06-29T12:00:00Z', now), '5w ago');
});
test('same year falls back to day-month', () => {
	assert.equal(formatRelativeDate('2026-02-26T12:00:00Z', now), '26 Feb');
});
test('older years include the year', () => {
	assert.equal(formatRelativeDate('2025-06-12T12:00:00Z', now), 'Jun 2025');
});
test('invalid input returns empty string', () => {
	assert.equal(formatRelativeDate(null, now), '');
});
```

- [ ] Step 2: `npm test` → new file FAILS (`formatRelativeDate` not exported).
- [ ] Step 3: Implement in `src/lib/index.js`:

```js
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatRelativeDate(value, now = new Date()) {
	if (!value) return '';
	const then = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(then.getTime())) return '';
	const days = Math.floor((now.getTime() - then.getTime()) / 86400000);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	if (days < 7) return `${days}d ago`;
	if (days < 56) return `${Math.floor(days / 7)}w ago`;
	if (then.getFullYear() === now.getFullYear()) return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
	return `${MONTHS[then.getMonth()]} ${then.getFullYear()}`;
}
```

- [ ] Step 4: `npm test` → PASS.
- [ ] Step 5: `db.js` listDialins: `ORDER BY updated_at DESC, id DESC`.
- [ ] Step 6: `+page.svelte`: import helper; add to both card types after notes: `<p class="updated">Updated {formatRelativeDate(entry.updated_at ?? entry.created_at)}</p>` (styled 0.72rem sans, ink-muted, margin-top 1rem). Extend `page.test.js` with a structural test that an element with class `updated` exists inside an element with class `card`.
- [ ] Step 7: `npm test` → PASS. Commit `feat: sort by last update and stamp cards with recency`.

### Task 2: Accessibility tokens — contrast, danger, focus-visible, label sizes, dark fields

**Files:**
- Modify: `src/routes/+layout.svelte` (tokens + global focus-visible)
- Modify: `src/routes/+page.svelte`, `src/lib/components/DialinForm.svelte`, `src/routes/login/+page.svelte` (use tokens, sizes, focus rings)

**Exact token changes (verify each with the contrast script before commit):**
- Light `--ink-muted`: `#86806f` → `#6c6659` (5.7:1 white, 5.2:1 bg)
- Dark `--ink-muted`: `#8a8171` → `#98907e` (5.3:1 surface, 5.8:1 bg)
- New `--danger`: light `#b3382c` (5.97:1), dark `#e5766a` (~5.7:1 surface)
- New `--field` (input background): light `#f6f4ef` (unchanged look), dark `#2a251e` (elevated above surface)

- [ ] Step 1: Add tokens to `:root` + dark block in `+layout.svelte`; add `:global(:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }`.
- [ ] Step 2: Replace all hardcoded `#b3382c` in `DialinForm.svelte` (`.danger`, `.form-error`, `.banner`) and `login/+page.svelte` (`.form-error`) with `var(--danger)`.
- [ ] Step 3: `DialinForm` + login inputs: `background: var(--field)`.
- [ ] Step 4: `+page.svelte`: bump `.label`, `.notes-label`, `.pour-schedule-label`, `.subtitle` from `0.68rem` → `0.72rem`; DialinForm `label` `0.7rem` → `0.72rem`. Remove `outline: none` from `.search`; add explicit `:focus-visible` rings for `.search`, `.chip`, `.edit-btn`.
- [ ] Step 5: Run contrast script for all six pairs; `npm test`; commit `fix: meet WCAG AA contrast and unify focus rings`.

### Task 3: Sticky header — scrolled hairline + mobile collapse

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] Step 1: `<svelte:window bind:scrollY={scrollY} />`, `const scrolled = $derived(scrollY > 16)`, `class:scrolled` on `.site-header`.
- [ ] Step 2: `.site-header { border-bottom: 1px solid transparent; }` + `.site-header.scrolled { border-bottom-color: var(--line-soft); }` (place **after** base rule), transition border-color.
- [ ] Step 3: In the 520px media block, **after** existing rules: collapse `.site-title`/`.header-actions` when `.scrolled` (max-height 3.5rem → 0, opacity → 0, overflow hidden, pointer-events none), transitions inside `prefers-reduced-motion: no-preference`.
- [ ] Step 4: `npm test` (page.test.js still green — rule order preserved); commit `feat: give sticky header a scrolled edge and collapse it on phones`.

### Task 4: Compact table view toggle (desktop)

**Files:**
- Modify: `src/routes/+page.svelte`, `src/routes/page.test.js`

**Interfaces:** `view: 'cards' | 'compact'` persisted at `localStorage['kohi:view']`; SSR renders cards.

- [ ] Step 1: Extend `page.test.js`: `.view-toggle` group exists with two buttons carrying `aria-pressed`; table header cells for espresso include Dose/Yield/Ratio/Time/Grind/Temp.
- [ ] Step 2: State + persistence (`browser` guard from `$app/environment`); toggle UI (`Cards | Table`) right-aligned in the chips row (chips row now also renders when entries exist); hidden ≤760px via CSS.
- [ ] Step 3: `{#if view === 'compact'}` render per-section `<table>` in `.table-wrap` (overflow-x auto): espresso cols Bean(roaster stacked)/Dose/Yield/Ratio/Time/Grind/Temp/Updated/edit(authed); pourover cols Bean/Dose/Water/Brewer/Grind/Temp/Time/Updated/edit. Grinds joined `K6 26 · Breville 7–8` via `formatRange`. `main` gets `class:wide` (`max-width: 60rem`) in compact mode.
- [ ] Step 4: `npm test`; commit `feat: add compact table view for comparing dial-ins`.

### Task 5: Drawer safety — dirty guard, pending states, inline delete confirm

**Files:**
- Modify: `src/lib/components/DialinForm.svelte`, `src/routes/login/+page.svelte`

- [ ] Step 1: `dirty`/`confirmDiscard` state; `oninput` on editor form sets dirty; `requestClose()` used by ×, Cancel, and dialog `oncancel` (preventDefault when guarding): first attempt turns Cancel into danger-styled `Discard changes?`, second closes. Reset on open.
- [ ] Step 2: `saving` state in `submitHandler` — primary button disabled + `Saving…`; delete submission disabled + `Deleting…`.
- [ ] Step 3: Replace `confirm()` delete with two-step inline UI: quiet `Delete this dial-in` → armed row `Delete permanently` (filled `--danger`) + ghost `Keep`.
- [ ] Step 4: Login: pending state (`Signing in…`, disabled).
- [ ] Step 5: `npm test` (zero-warning compile must hold); commit `feat: guard unsaved edits and make destructive actions two-step`.

### Task 6: Drawer clarity — visible row labels, pour-schedule precedence, live title

**Files:**
- Modify: `src/lib/components/DialinForm.svelte`

- [ ] Step 1: Make `.row-field > span` labels visible at all widths (remove clip hack; label above input, input `margin-top: 0.3rem` base); rows `align-items: end`; `.remove-row` sized to align with inputs; keep the phone-block declarations the tests assert.
- [ ] Step 2: Wrap Bloom/Total `grid2` in `{#if pourRows.length === 0}`, else hint `<p class="pour-hint">Timing comes from the pour schedule below.</p>`.
- [ ] Step 3: `beanName` state bound to Bean input; h2 = `beanName.trim() || dialin?.bean || 'Untitled coffee'`; grinder placeholder `Grinder (e.g. K6)`.
- [ ] Step 4: `npm test`; commit `fix: label repeatable rows everywhere and resolve timing-field conflict`.

### Task 7: Drawer motion

**Files:**
- Modify: `src/lib/components/DialinForm.svelte`

- [ ] Step 1: Inside `@media (prefers-reduced-motion: no-preference)` (rules placed after existing base/`:not([open])` rules): `transition: translate .22s ease, opacity .22s ease, display .22s allow-discrete, overlay .22s allow-discrete`; closed `translate: 100% 0; opacity: 0`; `[open] { translate: 0 0; opacity: 1 }` + `@starting-style` entry state; backdrop fade equivalents.
- [ ] Step 2: `npm test` (`.drawer:not([open]) { display: none }` untouched); commit `feat: ease the editor drawer in and out`.

### Task 8: Filter feedback — filled active chips with ×, clear-filters, empty states

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] Step 1: `.chip.active { background: var(--accent); border-color: var(--accent); color: var(--bg); }`; append `<span class="chip-x" aria-hidden="true">×</span>` when active.
- [ ] Step 2: Filtered-empty block gains `Clear filters` button resetting query/method/grinder.
- [ ] Step 3: True empty DB (`data.dialins.length === 0`): brand mark + tagline `A quiet log of espresso and pour-over dial-ins.` + authed CTA `Add your first dial-in` (opens drawer).
- [ ] Step 4: `npm test`; commit `feat: make active filters obvious and add real empty states`.

### Task 9: Brand & discoverability — mark in header/login/404, export link

**Files:**
- Modify: `src/routes/+page.svelte`, `src/routes/login/+page.svelte`, `src/routes/+error.svelte`

- [ ] Step 1: Header: favicon mark (28px, `alt=""`) beside the wordmark. Login + 404: 40px mark above heading.
- [ ] Step 2: Authed-only `<footer>`: `Export YAML` → `/export.yaml`.
- [ ] Step 3: `npm test`; commit `feat: carry the bean mark through the UI and expose YAML export`.

### Task 10: Small polish — kbd search hint, aria-hidden icons, last-used grinder

**Files:**
- Modify: `src/routes/+page.svelte`, `src/routes/page.test.js`, `src/lib/components/DialinForm.svelte`

- [ ] Step 1: Wrap search in `.search-wrap` (takes over the flex/grid placement — **update `page.test.js` search assertions to `search-wrap`**), placeholder → `Search beans, roasters, notes…`, absolute `<kbd>/</kbd>` hidden on `(hover: none)`, ≤520px, and `:focus-within`.
- [ ] Step 2: `aria-hidden="true"` on every icon SVG string.
- [ ] Step 3: `lastGrinder` prop (`getGrinderNames(data.dialins)[0]`) seeds new-entry grind row type.
- [ ] Step 4: `npm test`; commit `fix: polish search hint, icon semantics, and grinder defaults`.

### Task 11: Visual verification

- [ ] `npm run dev`, re-run Puppeteer capture (light+dark, desktop+mobile, drawer open/edit/pourover, table view, active filter, empty search, scrolled header) and fix anything that looks wrong; re-run `npm test`; final fixes committed individually.

## Self-Review

- Spec coverage: review items 1–21 → Tasks 1(dates/sort), 4(density), 3(header), 2(contrast/danger/focus/sizes/dark fields), 5–7(drawer), 8(chips/empty), 9(brand/export), 10(kbd/aria/grinder). ✓
- Placeholders: none — every task names exact files, values, and behavior. ✓
- Type consistency: `formatRelativeDate` signature used in Tasks 1 and 4; `view` values `'cards'|'compact'` consistent; `--danger`/`--field` tokens defined in Task 2, consumed in 5–8. ✓
