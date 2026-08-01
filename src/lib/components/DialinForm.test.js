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
	return children.find(
		node => node.type === 'Rule' && selectorNames(node.prelude, 'ClassSelector').includes(name)
	);
}

function classPseudoRule(children, className, pseudoName) {
	return children.find(
		node =>
			node.type === 'Rule' &&
			selectorNames(node.prelude, 'ClassSelector').includes(className) &&
			selectorNames(node.prelude, 'PseudoClassSelector').includes(pseudoName)
	);
}

function typeRule(children, name) {
	return children.find(
		node => node.type === 'Rule' && selectorNames(node.prelude, 'TypeSelector').includes(name)
	);
}

function classTypeRule(children, className, typeName) {
	return children.find(
		node =>
			node.type === 'Rule' &&
			selectorNames(node.prelude, 'ClassSelector').includes(className) &&
			selectorNames(node.prelude, 'TypeSelector').includes(typeName)
	);
}

function declarations(rule) {
	return Object.fromEntries(
		rule.block.children
			.filter(node => node.type === 'Declaration')
			.map(node => [node.property, node.value])
	);
}

function media(query) {
	return component.css.children.find(
		node => node.type === 'Atrule' && node.name === 'media' && node.prelude === query
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
	const closedDrawerRule = classPseudoRule(component.css.children, 'drawer', 'not');
	assert.ok(closedDrawerRule);
	const closedDrawer = declarations(closedDrawerRule);
	const headingRule = classRule(component.css.children, 'drawer-heading');
	const fieldsetRule = typeRule(component.css.children, 'fieldset');
	assert.ok(headingRule);
	assert.ok(fieldsetRule);
	const headingCss = declarations(headingRule);
	const fieldsetCss = declarations(fieldsetRule);
	const scrollCss = declarations(classRule(component.css.children, 'drawer-scroll'));
	assert.equal(drawer['box-sizing'], 'border-box');
	assert.equal(drawer.display, 'grid');
	assert.equal(drawer['grid-template-rows'], 'auto minmax(0, 1fr) auto');
	assert.equal(drawer.overflow, 'hidden');
	assert.equal(closedDrawer.display, 'none');
	assert.equal(headingCss['min-width'], '0');
	assert.equal(fieldsetCss['min-width'], '0');
	assert.equal(scrollCss['min-height'], '0');
	assert.equal(scrollCss['overflow-y'], 'auto');
});

test('phone editor fills the visual viewport and stacks repeatable fields without overflow', () => {
	const phone = media('(max-width: 520px)');
	assert.ok(phone);

	const drawer = declarations(classRule(phone.block.children, 'drawer'));
	assert.equal(drawer.inset, '0');
	assert.equal(drawer.width, '100%');
	assert.equal(drawer.height, '100dvh');
	assert.equal(drawer['max-height'], '100dvh');
	assert.equal(drawer['border-radius'], '0');

	const controls = declarations(typeRule(phone.block.children, 'input'));
	const grindRow = declarations(classRule(phone.block.children, 'grind-row'));
	const pourRow = declarations(classRule(phone.block.children, 'pour-row'));
	const actions = declarations(classRule(phone.block.children, 'drawer-actions'));
	const rowInputRule = classTypeRule(phone.block.children, 'row-field', 'input');
	assert.ok(rowInputRule);
	const rowInput = declarations(rowInputRule);
	assert.equal(controls['font-size'], '1rem');
	assert.equal(controls['min-height'], '44px');
	assert.equal(grindRow['grid-template-columns'], 'minmax(0, 1fr)');
	assert.equal(pourRow['grid-template-columns'], 'minmax(0, 1fr)');
	assert.equal(rowInput['margin-top'], '0.3rem');
	assert.match(actions['padding-bottom'], /safe-area-inset-bottom/);

	const compactPhone = media('(max-width: 360px)');
	assert.ok(compactPhone);
	const compactGrid = declarations(classRule(compactPhone.block.children, 'grid2'));
	assert.equal(compactGrid['grid-template-columns'], 'minmax(0, 1fr)');
});
