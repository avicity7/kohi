import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'svelte/compiler';

const componentPath = fileURLToPath(new URL('./+page.svelte', import.meta.url));
const component = parse(readFileSync(componentPath, 'utf8'), { filename: componentPath });

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

function selectorClasses(node) {
	const names = [];
	visit(node, item => {
		if (item.type === 'ClassSelector') names.push(item.name);
		return false;
	});
	return names;
}

function classRule(children, name) {
	return children.find(
		node => node.type === 'Rule' && selectorClasses(node.prelude).includes(name)
	);
}

function declarations(rule) {
	return Object.fromEntries(
		rule.block.children
			.filter(node => node.type === 'Declaration')
			.map(node => [node.property, node.value])
	);
}

test('mobile sign-in stays compact while remaining a full-size touch target', () => {
	const phone = component.css.children.find(
		node => node.type === 'Atrule' && node.name === 'media' && node.prelude === '(max-width: 520px)'
	);
	assert.ok(phone);

	const authRule = classRule(phone.block.children, 'auth-chip');
	assert.ok(authRule);
	const auth = declarations(authRule);

	assert.equal(auth['align-self'], 'flex-end');
	assert.equal(auth.display, 'inline-flex');
	assert.equal(auth.width, 'fit-content');
	assert.equal(auth['min-height'], '44px');
	assert.equal(auth['align-items'], 'center');
});
