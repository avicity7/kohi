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
		background: var(--field);
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
		color: var(--danger);
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
