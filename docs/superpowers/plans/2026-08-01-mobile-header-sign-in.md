# Mobile Header Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place the mobile sign-in action beside the Kohi title while keeping search and filters full-width below it.

**Architecture:** Add one semantic action-group wrapper around the existing anonymous and authenticated controls. At phone widths, switch only the site header from a vertical flex stack to an explicit two-column grid; desktop retains its existing flex layout.

**Tech Stack:** Svelte 5, component-scoped CSS, Node test runner, Svelte compiler AST

## Global Constraints

- Change only `src/routes/+page.svelte` and `src/routes/page.test.js`.
- Preserve all authentication form actions and event handlers.
- Preserve a minimum 44px touch target for the anonymous sign-in link.
- Do not introduce dependencies.

---

### Task 1: Stabilize the mobile header layout

**Files:**
- Modify: `src/routes/page.test.js`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `data.authed`, `openNew`, the existing `?/logout` form action, and `/login` link.
- Produces: a `.header-actions` element containing the current authentication controls and phone CSS that assigns the title/actions to row 1, search to row 2, and filters to row 3.

- [ ] **Step 1: Read the test-quality rules**

Read `superpowers/test-driven-development/writing-good-tests.md` before changing the regression test.

- [ ] **Step 2: Write the failing component-structure test**

In `src/routes/page.test.js`, add helpers that read static class attributes from Svelte `Element` nodes and locate an element by class:

```js
function elementClasses(node) {
	const attribute = node.attributes?.find(item => item.type === 'Attribute' && item.name === 'class');
	if (!attribute || attribute.value !== true && !Array.isArray(attribute.value)) return [];
	return (attribute.value === true ? [] : attribute.value)
		.filter(item => item.type === 'Text')
		.flatMap(item => item.data.split(/\s+/).filter(Boolean));
}

function elementWithClass(node, name) {
	return visit(node, item => item.type === 'Element' && elementClasses(item).includes(name));
}
```

Replace the previous compact-link assertion with a test named `mobile header keeps account actions beside the title` that verifies:

```js
const actions = elementWithClass(component.html, 'header-actions');
assert.ok(actions);
assert.ok(elementWithClass(actions, 'auth-chip'));

const phone = component.css.children.find(
	node => node.type === 'Atrule' && node.name === 'media' && node.prelude === '(max-width: 520px)'
);
assert.ok(phone);

const header = declarations(classRule(phone.block.children, 'site-header'));
assert.equal(header.display, 'grid');
assert.equal(header['grid-template-columns'], 'minmax(0, 1fr) auto');

const title = declarations(classRule(phone.block.children, 'site-title'));
assert.equal(title['grid-column'], '1');
assert.equal(title['grid-row'], '1');

const mobileActions = declarations(classRule(phone.block.children, 'header-actions'));
assert.equal(mobileActions['grid-column'], '2');
assert.equal(mobileActions['grid-row'], '1');
assert.equal(mobileActions['justify-self'], 'end');

const search = declarations(classRule(phone.block.children, 'search'));
assert.equal(search['grid-column'], '1 / -1');
assert.equal(search['grid-row'], '2');

const chips = declarations(classRule(phone.block.children, 'chips'));
assert.equal(chips['grid-column'], '1 / -1');
assert.equal(chips['grid-row'], '3');

const auth = declarations(classRule(phone.block.children, 'auth-chip'));
assert.equal(auth['min-height'], '44px');
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `node --test src/routes/page.test.js`

Expected: FAIL at `assert.ok(actions)` because `.header-actions` does not yet exist.

- [ ] **Step 4: Implement the minimal markup and responsive CSS**

In `src/routes/+page.svelte`, wrap the complete authentication conditional in:

```svelte
<div class="header-actions">
	{#if data.authed}
		<button class="chip add-chip" onclick={openNew}>+ Add</button>
		<form class="auth-form" method="POST" action="?/logout" use:enhance>
			<button class="chip">Sign out</button>
		</form>
	{:else}
		<a class="chip auth-chip" href="/login">Sign in</a>
	{/if}
</div>
```

Add the desktop action-group rule:

```css
.header-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex-shrink: 0;
}
```

Replace the phone header's column-stack and isolated right alignment with:

```css
.site-header {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 0.75rem;
	padding: 1.1rem 0 0.9rem;
}

.site-title {
	grid-column: 1;
	grid-row: 1;
}

.header-actions {
	grid-column: 2;
	grid-row: 1;
	justify-self: end;
}

.search {
	grid-column: 1 / -1;
	grid-row: 2;
	width: 100%;
}

.chips {
	grid-column: 1 / -1;
	grid-row: 3;
}

.auth-chip {
	display: inline-flex;
	min-height: 44px;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test src/routes/page.test.js`

Expected: PASS with one passing test and no warnings.

- [ ] **Step 6: Run repository verification**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: SvelteKit production build succeeds without compiler errors.

- [ ] **Step 7: Review the final diff and commit**

Run: `git diff --check` and `git diff -- src/routes/+page.svelte src/routes/page.test.js`.

Then commit only the implementation files:

```bash
git add src/routes/+page.svelte src/routes/page.test.js
git commit -m "fix: align mobile header account actions"
```
