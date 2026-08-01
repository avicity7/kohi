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

function elementClasses(node) {
	const attribute = node.attributes?.find(item => item.type === 'Attribute' && item.name === 'class');
	if (!Array.isArray(attribute?.value)) return [];
	return attribute.value
		.filter(item => item.type === 'Text')
		.flatMap(item => item.data.split(/\s+/).filter(Boolean));
}

function elementWithClass(node, name) {
	return visit(node, item => item.type === 'Element' && elementClasses(item).includes(name));
}

test('mobile header keeps account actions beside the title', () => {
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

	const authRule = classRule(phone.block.children, 'auth-chip');
	assert.ok(authRule);
	const auth = declarations(authRule);

	assert.equal(auth['min-height'], '44px');
});
