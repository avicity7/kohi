<script>
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';

	let { open = $bindable(false), dialin = null, grinderNames = [] } = $props();

	let dialogEl = $state(null);
	let method = $state('espresso');
	let grindRows = $state([]);
	let pourRows = $state([]);
	let errors = $state({});
	let message = $state('');
	let generation = $state(0);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	// Re-initialize the form every time the drawer opens.
	$effect(() => {
		if (!open) return;
		method = dialin?.method ?? 'espresso';
		grindRows = dialin?.grinds?.length
			? dialin.grinds.map(g => ({ type: g.type ?? '', setting: g.setting }))
			: [{ type: '', setting: '' }];
		pourRows = dialin?.pours?.length
			? dialin.pours.map(p => ({ water_g: p.water_g, time_s: p.time_s, notes: p.notes ?? '' }))
			: [];
		errors = {};
		message = '';
		generation = untrack(() => generation) + 1;
	});

	function submitHandler() {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				open = false;
			} else if (result.type === 'failure') {
				errors = result.data?.errors ?? {};
				message = result.data?.message ?? '';
			}
			await update({ reset: false });
		};
	}

	function deleteHandler({ cancel }) {
		if (!confirm(`Delete "${dialin.bean}"?`)) {
			cancel();
			return;
		}
		return async ({ result, update }) => {
			if (result.type === 'success') open = false;
			else if (result.type === 'failure') message = result.data?.message ?? 'Delete failed.';
			await update();
		};
	}
</script>

<dialog bind:this={dialogEl} class="drawer" onclose={() => (open = false)}>
	{#key generation}
		<header class="drawer-header">
			<h2>{dialin ? `Edit: ${dialin.bean}` : 'New dial-in'}</h2>
			<button type="button" class="ghost close" aria-label="Close" onclick={() => (open = false)}>×</button>
		</header>

		{#if message}<p class="form-error banner" role="alert">{message}</p>{/if}

		<form method="POST" action={dialin ? '?/update' : '?/create'} use:enhance={submitHandler}>
			{#if dialin}<input type="hidden" name="id" value={dialin.id} />{/if}

			<label>
				Bean
				<input name="bean" required value={dialin?.bean ?? ''} />
				{#if errors.bean}<span class="form-error">{errors.bean}</span>{/if}
			</label>

			<label>
				Roaster
				<input name="roaster" required value={dialin?.roaster ?? ''} />
				{#if errors.roaster}<span class="form-error">{errors.roaster}</span>{/if}
			</label>

			<fieldset class="segmented">
				<legend>Method</legend>
				<label class:active={method === 'espresso'}>
					<input type="radio" name="method" value="espresso" bind:group={method} />
					Espresso
				</label>
				<label class:active={method === 'pourover'}>
					<input type="radio" name="method" value="pourover" bind:group={method} />
					Pour Over
				</label>
			</fieldset>

			<div class="grid2">
				<label>
					Dose (g)
					<input name="dose_g" type="number" step="0.1" min="0" value={dialin?.dose_g ?? ''} />
					{#if errors.dose_g}<span class="form-error">{errors.dose_g}</span>{/if}
				</label>
				<label>
					Temp (°C)
					<input name="temperature_c" type="number" step="0.5" min="0" value={dialin?.temperature_c ?? ''} />
					{#if errors.temperature_c}<span class="form-error">{errors.temperature_c}</span>{/if}
				</label>
			</div>

			{#if method === 'espresso'}
				<div class="grid2">
					<label>
						Yield (g)
						<input name="yield_g" type="number" step="0.1" min="0" value={dialin?.yield_g ?? ''} />
						{#if errors.yield_g}<span class="form-error">{errors.yield_g}</span>{/if}
					</label>
					<label>
						Time (s)
						<input name="time_s" placeholder="28 or 28-32" value={dialin?.time_s ?? ''} />
						{#if errors.time_s}<span class="form-error">{errors.time_s}</span>{/if}
					</label>
				</div>
			{:else}
				<label>
					Method name
					<input name="method_name" placeholder="4:6 Method" value={dialin?.method_name ?? ''} />
				</label>
				<div class="grid2">
					<label>
						Water (g)
						<input name="water_g" type="number" step="1" min="0" value={dialin?.water_g ?? ''} />
						{#if errors.water_g}<span class="form-error">{errors.water_g}</span>{/if}
					</label>
					<label>
						Brewer
						<input name="brewer" placeholder="V60" value={dialin?.brewer ?? ''} />
					</label>
				</div>
				<div class="grid2">
					<label>
						Bloom (s)
						<input name="bloom_time_s" placeholder="45" value={dialin?.bloom_time_s ?? ''} />
						{#if errors.bloom_time_s}<span class="form-error">{errors.bloom_time_s}</span>{/if}
					</label>
					<label>
						Total time (s)
						<input name="total_time_s" placeholder="210" value={dialin?.total_time_s ?? ''} />
						{#if errors.total_time_s}<span class="form-error">{errors.total_time_s}</span>{/if}
					</label>
				</div>

				<fieldset class="rows">
					<legend>Pour schedule</legend>
					{#each pourRows as row, i (i)}
						<div class="row pour-row">
							<input name="pour_water" type="number" step="1" min="0" placeholder="g" bind:value={row.water_g} aria-label="Pour {i + 1} water (g)" />
							<input name="pour_time" type="number" step="1" min="0" placeholder="@ s" bind:value={row.time_s} aria-label="Pour {i + 1} time (s)" />
							<input name="pour_notes" placeholder="note" bind:value={row.notes} aria-label="Pour {i + 1} note" />
							<button type="button" class="ghost" aria-label="Remove pour {i + 1}" onclick={() => pourRows.splice(i, 1)}>−</button>
						</div>
					{/each}
					<button type="button" class="ghost add-row" onclick={() => pourRows.push({ water_g: '', time_s: '', notes: '' })}>+ Pour</button>
					{#if errors.pours}<span class="form-error">{errors.pours}</span>{/if}
				</fieldset>
			{/if}

			<fieldset class="rows">
				<legend>Grinds</legend>
				<datalist id="grinder-names">
					{#each grinderNames as name}<option value={name}></option>{/each}
				</datalist>
				{#each grindRows as row, i (i)}
					<div class="row grind-row">
						<input name="grind_type" list="grinder-names" placeholder="Grinder (optional)" bind:value={row.type} aria-label="Grind {i + 1} grinder" />
						<input name="grind_setting" placeholder="27 or 7-8" bind:value={row.setting} aria-label="Grind {i + 1} setting" />
						<button type="button" class="ghost" aria-label="Remove grind {i + 1}" onclick={() => grindRows.splice(i, 1)}>−</button>
					</div>
				{/each}
				<button type="button" class="ghost add-row" onclick={() => grindRows.push({ type: '', setting: '' })}>+ Grinder</button>
				{#if errors.grinds}<span class="form-error">{errors.grinds}</span>{/if}
			</fieldset>

			<label>
				Notes
				<textarea name="notes" rows="3">{dialin?.notes ?? ''}</textarea>
			</label>

			<footer class="drawer-actions">
				<button type="button" class="ghost" onclick={() => (open = false)}>Cancel</button>
				<button class="primary">Save</button>
			</footer>
		</form>

		{#if dialin}
			<form method="POST" action="?/delete" use:enhance={deleteHandler} class="delete-form">
				<input type="hidden" name="id" value={dialin.id} />
				<button class="danger">Delete this dial-in</button>
			</form>
		{/if}
	{/key}
</dialog>

<style>
	.drawer {
		position: fixed;
		inset: 0 0 0 auto;
		margin: 0;
		height: 100dvh;
		max-height: 100dvh;
		width: min(26rem, 100vw);
		max-width: 100vw;
		border: none;
		border-left: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		padding: 1.5rem;
		overflow-y: auto;
		font-family: var(--sans);
	}

	.drawer::backdrop {
		background: rgba(0, 0, 0, 0.35);
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.drawer-header h2 {
		font-family: var(--serif);
		font-size: 1.2rem;
		margin: 0;
	}

	form > label,
	.grid2 {
		display: block;
		margin-bottom: 0.9rem;
	}

	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--ink-muted);
	}

	input,
	textarea {
		display: block;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.3rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--sans);
		font-size: 0.95rem;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	fieldset {
		border: 1px solid var(--line-soft);
		border-radius: 8px;
		padding: 0.75rem;
		margin: 0 0 0.9rem;
	}

	legend {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--ink-muted);
		padding: 0 0.3rem;
	}

	.segmented {
		display: flex;
		gap: 0.4rem;
	}

	.segmented label {
		flex: 1;
		text-align: center;
		padding: 0.45rem 0;
		border: 1px solid var(--line);
		border-radius: 999px;
		cursor: pointer;
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.segmented label.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, var(--surface));
		color: var(--accent);
	}

	.segmented input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.row {
		display: grid;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
		align-items: center;
	}

	.grind-row {
		grid-template-columns: 1fr 1fr auto;
	}

	.pour-row {
		grid-template-columns: 1fr 1fr 1.4fr auto;
	}

	.row input {
		margin-top: 0;
	}

	button {
		font-family: var(--sans);
		cursor: pointer;
	}

	.ghost {
		background: none;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: var(--ink-soft);
		padding: 0.35rem 0.7rem;
		font-size: 0.85rem;
	}

	.ghost:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.close {
		border: none;
		font-size: 1.3rem;
		line-height: 1;
		padding: 0.2rem 0.5rem;
	}

	.add-row {
		margin-top: 0.2rem;
	}

	.drawer-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1.25rem;
	}

	.primary {
		background: var(--accent);
		color: var(--bg);
		border: none;
		border-radius: 8px;
		padding: 0.55rem 1.3rem;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.delete-form {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
		text-align: center;
	}

	.danger {
		background: none;
		border: none;
		color: #b3382c;
		font-size: 0.85rem;
	}

	.form-error {
		display: block;
		color: #b3382c;
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: normal;
		margin-top: 0.3rem;
	}

	.banner {
		border: 1px solid color-mix(in srgb, #b3382c 40%, var(--line));
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		margin: 0 0 1rem;
	}

	@media (max-width: 520px) {
		.drawer {
			inset: auto 0 0 0;
			width: 100%;
			height: auto;
			max-height: 88dvh;
			border-left: none;
			border-top: 1px solid var(--line);
			border-radius: 14px 14px 0 0;
		}
	}
</style>
