# Responsive Dial-In Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dial-in create/edit dialog reliable and touch-friendly on phone viewports while refining its desktop drawer presentation.

**Architecture:** Keep the native `<dialog>` and existing Svelte form behavior. Restructure the component into fixed header, independently scrolling body, and fixed footer regions; connect the footer Save button to the create/update form with native form ownership. Use component-scoped responsive CSS for an edge-to-edge phone editor and a right drawer on larger screens.

**Tech Stack:** Svelte 5, SvelteKit 2, native HTML dialog/forms, component-scoped CSS, Node's built-in test runner, `svelte/compiler`.

## Global Constraints

- At widths above 520px, retain a right-hand drawer.
- At widths of 520px and below, use an edge-to-edge editor with `100dvh` height.
- Only the form body scrolls; the header and action bar remain visible.
- Preserve create, edit, delete, validation, method switching, dynamic rows, Escape, Cancel, and close behavior.
- Do not change server actions, field names, database schema, authentication, or the dial-in data shape.
- Use at least 16px form-control text and 44px primary touch targets on phones.
- Add no runtime or test dependency.

---

## File structure

- Create `src/lib/components/DialinForm.test.js`: compile/parse the real Svelte component and assert the responsive layout contract from its HTML and CSS AST.
- Modify `src/lib/components/DialinForm.svelte`: adaptive dialog regions, semantic grouping, repeatable-row labels, accessibility attributes, and responsive styles.
- Modify `docs/superpowers/specs/2026-07-31-responsive-dialin-editor-design.md`: clarify the native form ownership used to keep the delete form separate.

### Task 1: Persistent editor regions and form ownership

**Files:**

- Create: `src/lib/components/DialinForm.test.js`
- Modify: `src/lib/components/DialinForm.svelte`

**Interfaces:**

- Consumes: existing `open`, `dialin`, and `grinderNames` props; existing `submitHandler()` and `deleteHandler()` enhanced-form callbacks.
- Produces: static form id `dialin-editor-form`; dialog label id `dialin-form-title`; layout classes `drawer-header`, `drawer-scroll`, and `drawer-actions`.

- [ ] **Step 1: Write the failing structural regression test**

Create the test utilities and first test:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compile, parse } from 'svelte/compiler';

const componentPath = fileURLToPath(new URL('./DialinForm.svelte', import.meta.url));
const source = readFileSync(componentPath, 'utf8');
const component = parse(source, { filename: componentPath });

function visit(node, predicate) {
	if (!node || typeof node !== 'object') return null;
	if (predicate(node)) return node;
	for (const [key, value] of Object.entries(node)) {
		if (key === 'metadata' || key === 'parent') continue;
		const values = Array.isArray(value) ? value : [value];
		for (const child of values) {
			const match = visit(child, predicate);
			if (match) return match;
		}
	}
	return null;
}

function parentOf(node, target) {
	if (!node || typeof node !== 'object') return null;
	for (const [key, value] of Object.entries(node)) {
		if (key === 'metadata' || key === 'parent') continue;
		const values = Array.isArray(value) ? value : [value];
		if (values.includes(target)) return node;
		for (const child of values) {
			const parent = parentOf(child, target);
			if (parent) return parent;
		}
	}
	return null;
}

function attribute(node, name) {
	const match = node.attributes?.find(item => item.type === 'Attribute' && item.name === name);
	if (!match || match.value === true) return match ? true : null;
	return match.value.map(part => part.data ?? part.raw ?? '').join('');
}

function hasClass(node, name) {
	return String(attribute(node, 'class') ?? '').split(/\s+/).includes(name);
}

function element(name, predicate = () => true) {
	return visit(component.html, node => node.type === 'Element' && node.name === name && predicate(node));
}

function classElement(name) {
	return visit(component.html, node => node.type === 'Element' && hasClass(node, name));
}

function selectorNames(node, type) {
	const names = [];
	visit(node, item => {
		if (item.type === type) names.push(item.name);
		return false;
	});
	return names;
}

function classRule(children, name) {
	return children.find(node =>
		node.type === 'Rule' && selectorNames(node.prelude, 'ClassSelector').includes(name)
	);
}

function declarations(rule) {
	return Object.fromEntries(
		rule.block.children
			.filter(node => node.type === 'Declaration')
			.map(node => [node.property, node.value])
	);
}

test('editor keeps its header, scrolling fields, and primary actions in persistent regions', () => {
	const compiled = compile(source, { filename: componentPath, generate: 'client', css: 'external' });
	assert.deepEqual(compiled.warnings, []);

	const dialog = element('dialog');
	const header = classElement('drawer-header');
	const scroll = classElement('drawer-scroll');
	const actions = classElement('drawer-actions');
	const editorForm = element('form', node => attribute(node, 'id') === 'dialin-editor-form');
	const save = element(
		'button',
		node => hasClass(node, 'primary') && attribute(node, 'form') === 'dialin-editor-form'
	);

	assert.equal(attribute(dialog, 'aria-labelledby'), 'dialin-form-title');
	assert.equal(attribute(element('h2'), 'id'), 'dialin-form-title');
	assert.equal(parentOf(component.html, header), parentOf(component.html, scroll));
	assert.equal(parentOf(component.html, scroll), parentOf(component.html, actions));
	assert.ok(header.end < scroll.start && scroll.end < actions.start);
	assert.ok(editorForm);
	assert.equal(attribute(save, 'type'), 'submit');

	const drawer = declarations(classRule(component.css.children, 'drawer'));
	const scrollCss = declarations(classRule(component.css.children, 'drawer-scroll'));
	assert.equal(drawer['box-sizing'], 'border-box');
	assert.equal(drawer.display, 'grid');
	assert.equal(drawer['grid-template-rows'], 'auto minmax(0, 1fr) auto');
	assert.equal(drawer.overflow, 'hidden');
	assert.equal(scrollCss['min-height'], '0');
	assert.equal(scrollCss['overflow-y'], 'auto');
});
```

The production mutation this catches is collapsing the editor back into one scrolling region or disconnecting Save from the create/update form.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test src/lib/components/DialinForm.test.js
```

Expected: FAIL because `drawer-scroll`, `aria-labelledby`, and `dialin-editor-form` do not exist and `.drawer` is not a three-row grid.

- [ ] **Step 3: Restructure the dialog into persistent regions**

Change the dialog opening and header to:

```svelte
<dialog
	bind:this={dialogEl}
	class="drawer"
	aria-labelledby="dialin-form-title"
	onclose={() => (open = false)}
>
	{#key generation}
		<header class="drawer-header">
			<div>
				<p class="drawer-kicker">{dialin ? 'Edit dial-in' : 'New dial-in'}</p>
				<h2 id="dialin-form-title">{dialin?.bean ?? 'Coffee recipe'}</h2>
			</div>
			<button type="button" class="ghost close" aria-label="Close" onclick={() => (open = false)}>×</button>
		</header>

		<div class="drawer-scroll">
```

Keep the existing feedback and fields inside `drawer-scroll`. Give the primary form a stable id:

```svelte
<form
	id="dialin-editor-form"
	method="POST"
	action={dialin ? '?/update' : '?/create'}
	use:enhance={submitHandler}
>
```

Remove the existing in-form `drawer-actions` footer. Keep the existing edit-only delete form after the primary form, then close `drawer-scroll` and add the persistent action bar:

```svelte
		</div>

		<footer class="drawer-actions">
			<button type="button" class="ghost cancel" onclick={() => (open = false)}>Cancel</button>
			<button type="submit" form="dialin-editor-form" class="primary">
				{dialin ? 'Save changes' : 'Add dial-in'}
			</button>
		</footer>
	{/key}
</dialog>
```

Replace the dialog-level scrolling CSS with:

```css
.drawer {
	position: fixed;
	inset: 0 0 0 auto;
	box-sizing: border-box;
	display: grid;
	grid-template-rows: auto minmax(0, 1fr) auto;
	margin: 0;
	width: min(29rem, 100vw);
	max-width: 100vw;
	height: 100dvh;
	max-height: 100dvh;
	overflow: hidden;
	border: none;
	border-left: 1px solid var(--line);
	background: var(--surface);
	color: var(--ink);
	padding: 0;
	font-family: var(--sans);
}

.drawer-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	padding: 1.25rem 1.5rem 1rem;
	border-bottom: 1px solid var(--line-soft);
}

.drawer-scroll {
	min-width: 0;
	min-height: 0;
	overflow-x: hidden;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 1.25rem 1.5rem 2rem;
}

.drawer-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.65rem;
	margin: 0;
	padding: 1rem 1.5rem;
	border-top: 1px solid var(--line-soft);
	background: var(--surface);
	box-shadow: 0 -8px 24px color-mix(in srgb, var(--ink) 5%, transparent);
}
```

Add a small uppercase kicker, allow long bean names to wrap, and give the close button a 44px square target.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test src/lib/components/DialinForm.test.js
```

Expected: PASS with one passing test and no Svelte compiler warnings.

- [ ] **Step 5: Run the existing suite**

Run:

```powershell
npm.cmd test
```

Expected: all existing tests and the new component test pass.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/lib/components/DialinForm.svelte src/lib/components/DialinForm.test.js
git commit -m "fix: keep dial-in editor actions reachable"
```

### Task 2: Phone-safe fields, repeatable rows, and interaction polish

**Files:**

- Modify: `src/lib/components/DialinForm.test.js`
- Modify: `src/lib/components/DialinForm.svelte`
- Modify: `docs/superpowers/specs/2026-07-31-responsive-dialin-editor-design.md`

**Interfaces:**

- Consumes: Task 1's `drawer-scroll`, `drawer-actions`, `dialin-editor-form`, and three-row dialog layout.
- Produces: `row-field` and `remove-row` classes; phone CSS at 520px; compact-phone CSS at 360px; visible section headings.

- [ ] **Step 1: Add the failing phone-layout test**

Add helpers and the second test:

```js
function typeRule(children, name) {
	return children.find(node =>
		node.type === 'Rule' && selectorNames(node.prelude, 'TypeSelector').includes(name)
	);
}

function media(query) {
	return component.css.children.find(
		node => node.type === 'Atrule' && node.name === 'media' && node.prelude === query
	);
}

test('phone editor fills the visual viewport and stacks repeatable fields without overflow', () => {
	const phone = media('(max-width: 520px)');
	const compactPhone = media('(max-width: 360px)');
	assert.ok(phone);
	assert.ok(compactPhone);

	const drawer = declarations(classRule(phone.block.children, 'drawer'));
	const controls = declarations(typeRule(phone.block.children, 'input'));
	const grindRow = declarations(classRule(phone.block.children, 'grind-row'));
	const pourRow = declarations(classRule(phone.block.children, 'pour-row'));
	const actions = declarations(classRule(phone.block.children, 'drawer-actions'));
	const compactGrid = declarations(classRule(compactPhone.block.children, 'grid2'));

	assert.equal(drawer.inset, '0');
	assert.equal(drawer.width, '100%');
	assert.equal(drawer.height, '100dvh');
	assert.equal(drawer['max-height'], '100dvh');
	assert.equal(drawer['border-radius'], '0');
	assert.equal(controls['font-size'], '1rem');
	assert.equal(controls['min-height'], '44px');
	assert.equal(grindRow['grid-template-columns'], 'minmax(0, 1fr)');
	assert.equal(pourRow['grid-template-columns'], 'minmax(0, 1fr)');
	assert.match(actions['padding-bottom'], /safe-area-inset-bottom/);
	assert.equal(compactGrid['grid-template-columns'], 'minmax(0, 1fr)');
});
```

The production mutation this catches is restoring the oversized bottom sheet, sub-16px inputs, or compressed repeatable-row columns on phones.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test src/lib/components/DialinForm.test.js
```

Expected: the first test passes and the phone-layout test fails because the current mobile drawer is an 88dvh bottom sheet and repeatable rows remain multi-column.

- [ ] **Step 3: Add visible section hierarchy**

Immediately after the existing hidden `id` input, insert the Coffee section opening:

```svelte
			<section class="form-section" aria-labelledby="coffee-section-title">
				<h3 id="coffee-section-title" class="section-title">Coffee</h3>
```

Immediately after the existing Method `fieldset.segmented`, close Coffee and open Recipe:

```svelte
			</section>

			<section class="form-section" aria-labelledby="recipe-section-title">
				<h3 id="recipe-section-title" class="section-title">Recipe</h3>
```

Immediately after the espresso/pour-over `{#if}` block, close Recipe and open Grinder:

```svelte
			</section>

			<section class="form-section" aria-labelledby="grinder-section-title">
				<h3 id="grinder-section-title" class="section-title">Grinder</h3>
```

Immediately after the existing grinder `fieldset.rows`, close Grinder:

```svelte
			</section>
```

This leaves Bean, Roaster, and Method inside Coffee; dose/temperature and the method-specific controls inside Recipe; the existing grinder fieldset inside Grinder; and Notes after Grinder. Do not alter any `name`, `bind:value`, error condition, or method conditional.

Style the section rhythm:

```css
.form-section {
	margin: 0 0 1.35rem;
	padding: 0 0 1.35rem;
	border-bottom: 1px solid var(--line-soft);
}

.section-title {
	margin: 0 0 1rem;
	font-family: var(--sans);
	font-size: 0.72rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.12em;
	color: var(--accent);
}
```

- [ ] **Step 4: Label repeatable fields and enlarge row controls**

For every grinder row, wrap each input with a visible-on-phone label:

```svelte
<div class="row grind-row">
	<label class="row-field">
		<span>Grinder</span>
		<input name="grind_type" list="grinder-names" placeholder="Optional" bind:value={row.type} aria-label="Grind {i + 1} grinder" />
	</label>
	<label class="row-field">
		<span>Setting</span>
		<input name="grind_setting" placeholder="27 or 7-8" bind:value={row.setting} aria-label="Grind {i + 1} setting" />
	</label>
	<button type="button" class="ghost remove-row" aria-label="Remove grind {i + 1}" onclick={() => grindRows.splice(i, 1)}>−</button>
</div>
```

Apply the same pattern to pour rows with labels `Water (g)`, `At (s)`, and `Note`, preserving the existing names, bindings, and aria-labels. Give every remove button the `remove-row` class.

Use zero-minimum grid tracks and 44px removal targets:

```css
.grind-row {
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
}

.pour-row {
	grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1.4fr) auto;
}

.grid2 > *,
.row-field {
	min-width: 0;
}

.row-field > span {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
	white-space: nowrap;
}

.remove-row,
.close {
	display: inline-grid;
	width: 44px;
	height: 44px;
	place-items: center;
	padding: 0;
}
```

- [ ] **Step 5: Replace the phone bottom sheet rules**

Replace the current 520px media query and add the 360px query:

```css
@media (max-width: 520px) {
	.drawer {
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100dvh;
		max-height: 100dvh;
		border: none;
		border-radius: 0;
	}

	.drawer-header {
		padding-top: max(0.85rem, env(safe-area-inset-top));
		padding-right: max(1rem, env(safe-area-inset-right));
		padding-left: max(1rem, env(safe-area-inset-left));
	}

	.drawer-scroll {
		padding: 1rem max(1rem, env(safe-area-inset-right)) 1.5rem max(1rem, env(safe-area-inset-left));
	}

	input,
	textarea {
		min-height: 44px;
		font-size: 1rem;
		padding: 0.7rem 0.75rem;
	}

	.grind-row,
	.pour-row {
		grid-template-columns: minmax(0, 1fr);
		gap: 0.65rem;
		padding: 0.75rem;
		border: 1px solid var(--line-soft);
		border-radius: 10px;
		background: color-mix(in srgb, var(--bg) 65%, var(--surface));
	}

	.row-field > span {
		position: static;
		display: block;
		width: auto;
		height: auto;
		overflow: visible;
		clip: auto;
		white-space: normal;
	}

	.remove-row {
		justify-self: end;
	}

	.drawer-actions {
		padding: 0.75rem max(1rem, env(safe-area-inset-right))
			max(0.75rem, env(safe-area-inset-bottom))
			max(1rem, env(safe-area-inset-left));
	}

	.drawer-actions button {
		flex: 1;
		min-height: 44px;
	}

	.drawer-actions .primary {
		flex: 1.35;
	}
}

@media (max-width: 360px) {
	.grid2 {
		grid-template-columns: minmax(0, 1fr);
	}
}
```

- [ ] **Step 6: Add keyboard-focus polish**

Keep the existing focus border and add:

```css
input:focus-visible,
textarea:focus-visible,
button:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}

.segmented label:focus-within {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}
```

Ensure `.primary`, `.ghost`, and `.danger` transitions do not animate layout properties. Do not add mandatory motion.

- [ ] **Step 7: Run the focused test and verify GREEN**

Run:

```powershell
node --test src/lib/components/DialinForm.test.js
```

Expected: two passing tests and no Svelte compiler warnings.

- [ ] **Step 8: Run full verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all tests pass and the SvelteKit production build exits 0 without component warnings.

- [ ] **Step 9: Inspect responsive output when browser control is available**

Open the authenticated app and verify:

- 320 × 568: no horizontal overflow; all fields and actions fit; numeric pairs stack.
- 390 × 844: header/action bar remain visible while body scrolls; keyboard focus does not zoom inputs.
- 768 × 1024: right drawer presentation is retained.
- 1440 × 900: drawer width, section hierarchy, focus, create/edit, method switching, row add/remove, Cancel, Escape, Save, and delete confirmation remain correct.

If the interactive browser is unavailable, record that limitation; do not substitute source inspection for visual evidence.

- [ ] **Step 10: Commit Task 2**

```powershell
git add src/lib/components/DialinForm.svelte src/lib/components/DialinForm.test.js docs/superpowers/specs/2026-07-31-responsive-dialin-editor-design.md
git commit -m "fix: redesign dial-in editor for phones"
```
