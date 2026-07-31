<script>
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		color-scheme: light dark;
		--bg: #f6f4ef;
		--surface: #ffffff;
		--ink: #23201b;
		--ink-soft: #5c564d;
		--ink-muted: #86806f;
		--line: #e4dfd4;
		--line-soft: #eeeae0;
		--accent: #7c5335;
		--shadow: 0 1px 2px rgba(35, 32, 27, 0.04), 0 4px 12px rgba(35, 32, 27, 0.03);
		--serif: 'Source Serif 4', Georgia, serif;
		--sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--bg: #171410;
			--surface: #211d18;
			--ink: #ece7dd;
			--ink-soft: #b3ab9c;
			--ink-muted: #8a8171;
			--line: #37312a;
			--line-soft: #2b2621;
			--accent: #c99e6e;
			--shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15);
		}
	}

	:global(body) {
		margin: 0;
		background: var(--bg);
		font-family: var(--serif);
		color: var(--ink);
		-webkit-font-smoothing: antialiased;
	}
</style>
