<script>
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
</script>

<svelte:head>
	<title>{page.status} · Kohi</title>
</svelte:head>

<main>
	<img class="mark" src={favicon} alt="" width="44" height="44" />
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

	.mark {
		display: block;
		border-radius: 10px;
		margin: 0 auto 1.25rem;
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
