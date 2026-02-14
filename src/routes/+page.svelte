<script>
	let { data } = $props();

	const espresso = $derived(data.dialins.filter(d => d.method === 'espresso'));
	const pourover = $derived(data.dialins.filter(d => d.method === 'pourover'));

	function formatTime(input) {
		// Handle range strings like "28-32"
		if (typeof input === 'string' && input.includes('-')) {
			const [start, end] = input.split('-').map(Number);
			return `${formatTimeSeconds(start)}-${formatTimeSeconds(end)}`;
		}
		// Handle single numeric values
		return formatTimeSeconds(Number(input));
	}

	function formatTimeSeconds(seconds) {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		if (m === 0) return `${s}s`;
		return s === 0 ? `${m}m` : `${m}m ${s}s`;
	}

	function calculateRatio(dose, yield_) {
		const ratio = yield_ / dose;
		return `1:${ratio.toFixed(1)}`;
	}

	function getTotalTime(entry) {
		// If pours array exists, return the last pour's time
		if (entry.pours && entry.pours.length > 0) {
			return entry.pours[entry.pours.length - 1].time_s;
		}
		// Fallback to total_time_s for simple format
		return entry.total_time_s;
	}

	const icons = {
		dose: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v17"/><path d="M5 8l7-5 7 5"/><path d="M3 21h18"/><circle cx="7" cy="15" r="2"/><circle cx="17" cy="15" r="2"/></svg>`,
		yield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
		ratio: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
		time: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
		grind: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
		temp: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
		water: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
		brewer: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
		bloom: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><line x1="12" y1="8" x2="12" y2="14"/></svg>`,
		pour: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.5L12 11.5L17 16.5"/><path d="M12 11.5V21"/><circle cx="12" cy="5" r="3"/></svg>`,
		notes: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
	};
</script>

<svelte:head>
	<title>Kohi - Coffee Dial-In</title>
</svelte:head>

<main>
	<h1>Kohi</h1>
	<p class="subtitle">Coffee Dial-In Log</p>

	{#if espresso.length > 0}
		<section>
			<h2>Espresso</h2>
			{#each espresso as entry}
				<div class="card">
					<div class="card-header">
						<h3>{entry.bean}</h3>
						<span class="roaster">{entry.roaster}</span>
					</div>
					<div class="params">
						<div class="param">
							<span class="label">{@html icons.dose} Dose</span>
							<span class="value">{entry.dose_g}g</span>
						</div>
						<div class="param">
							<span class="label">{@html icons.yield} Yield</span>
							<span class="value">{entry.yield_g}g</span>
						</div>
						<div class="param">
							<span class="label">{@html icons.ratio} Ratio</span>
							<span class="value">{calculateRatio(entry.dose_g, entry.yield_g)}</span>
						</div>
						<div class="param">
							<span class="label">{@html icons.time} Time</span>
							<span class="value">{formatTime(entry.time_s)}</span>
						</div>
						<div class="param">
							<span class="label">{@html icons.grind} Grind</span>
							<span class="value">{entry.grind}</span>
						</div>
						{#if entry.temperature_c}
							<div class="param">
								<span class="label">{@html icons.temp} Temp</span>
								<span class="value">{entry.temperature_c}&deg;C</span>
							</div>
						{/if}
					</div>
					{#if entry.notes}
						<div class="notes">
							<span class="notes-label">{@html icons.notes} Notes</span>
							<p class="notes-text">{entry.notes}</p>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}

	{#if pourover.length > 0}
		<section>
			<h2>Pour Over</h2>
			{#each pourover as entry}
				<div class="card">
					<div class="card-header">
						<h3>{entry.bean}</h3>
						<span class="roaster">{entry.roaster}</span>
						{#if entry.method_name}
							<span class="method-badge">{entry.method_name}</span>
						{/if}
					</div>

					<div class="params">
						<div class="param">
							<span class="label">{@html icons.dose} Dose</span>
							<span class="value">{entry.dose_g}g</span>
						</div>
						<div class="param">
							<span class="label">{@html icons.water} Water</span>
							<span class="value">{entry.water_g}g</span>
						</div>
						<div class="param">
							<span class="label">{@html icons.brewer} Brewer</span>
							<span class="value">{entry.brewer}</span>
						</div>
						<div class="param">
							<span class="label">{@html icons.grind} Grind</span>
							<span class="value">{entry.grind}</span>
						</div>
						{#if entry.temperature_c}
							<div class="param">
								<span class="label">{@html icons.temp} Temp</span>
								<span class="value">{entry.temperature_c}&deg;C</span>
							</div>
						{/if}

						{#if entry.pours && entry.pours.length > 0}
							<!-- Multi-pour format: show total time only -->
							<div class="param">
								<span class="label">{@html icons.time} Total time</span>
								<span class="value">{formatTime(getTotalTime(entry))}</span>
							</div>
						{:else}
							<!-- Simple format: show bloom and total time -->
							<div class="param">
								<span class="label">{@html icons.bloom} Bloom</span>
								<span class="value">{formatTime(entry.bloom_time_s)}</span>
							</div>
							<div class="param">
								<span class="label">{@html icons.time} Total time</span>
								<span class="value">{formatTime(entry.total_time_s)}</span>
							</div>
						{/if}
					</div>

					<!-- Pour schedule timeline -->
					{#if entry.pours && entry.pours.length > 0}
						<div class="pour-schedule">
							<div class="pour-schedule-header">
								<span class="pour-schedule-label">{@html icons.pour} Pour Schedule</span>
							</div>
							<div class="timeline">
								{#each entry.pours as pour, index}
									<div class="timeline-step">
										<div class="timeline-marker">
											<span class="step-number">{index + 1}</span>
										</div>
										<div class="timeline-content">
											<div class="timeline-main">
												<span class="pour-water">{pour.water_g}g</span>
												<span class="pour-time">@ {formatTime(pour.time_s)}</span>
											</div>
											{#if pour.notes}
												<div class="timeline-notes">{pour.notes}</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if entry.notes}
						<div class="notes">
							<span class="notes-label">{@html icons.notes} Notes</span>
							<p class="notes-text">{entry.notes}</p>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #faf9f6;
		font-family: 'Source Serif 4', 'Georgia', serif;
		color: #2c2c2c;
	}

	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 3rem 1.5rem;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1.1rem;
		color: #888;
		margin: 0 0 2.5rem;
	}

	h2 {
		font-size: 1.3rem;
		font-weight: 600;
		margin: 0 0 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #666;
	}

	section {
		margin-bottom: 2.5rem;
	}

	.card {
		background: #fff;
		border: 1px solid #e8e6e1;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	.card-header {
		margin-bottom: 1rem;
	}

	.card-header h3 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.2rem;
	}

	.roaster {
		font-size: 0.95rem;
		color: #999;
	}

	.params {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.param {
		display: flex;
		flex-direction: column;
	}

	.label {
		font-size: 0.75rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #aaa;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.value {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 1.05rem;
		font-weight: 500;
	}

	.notes {
		margin: 1.25rem 0 0;
		padding-top: 1rem;
		border-top: 1px solid #f0eeea;
	}

	.notes-label {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #aaa;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.notes-text {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		margin: 0.4rem 0 0;
		color: #666;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	/* Method badge */
	.method-badge {
		display: inline-block;
		margin-top: 0.4rem;
		padding: 0.25rem 0.6rem;
		background: #f0eeea;
		border-radius: 6px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 0.75rem;
		font-weight: 500;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Pour schedule section */
	.pour-schedule {
		margin: 1.25rem 0 0;
		padding-top: 1rem;
		border-top: 1px solid #f0eeea;
	}

	.pour-schedule-header {
		margin-bottom: 0.75rem;
	}

	.pour-schedule-label {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #aaa;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	/* Timeline */
	.timeline {
		position: relative;
		padding-left: 2rem;
	}

	.timeline::before {
		content: '';
		position: absolute;
		left: 0.75rem;
		top: 0;
		bottom: 0;
		width: 2px;
		background: linear-gradient(to bottom, #e8e6e1 0%, #e8e6e1 100%);
	}

	.timeline-step {
		position: relative;
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.timeline-step:last-child {
		margin-bottom: 0;
	}

	.timeline-marker {
		position: absolute;
		left: -2rem;
		width: 1.5rem;
		height: 1.5rem;
		background: #fff;
		border: 2px solid #e8e6e1;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}

	.step-number {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		color: #888;
	}

	.timeline-content {
		flex: 1;
		padding-bottom: 0.5rem;
	}

	.timeline-main {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.pour-water {
		font-size: 1rem;
		font-weight: 600;
		color: #2c2c2c;
	}

	.pour-time {
		font-size: 0.85rem;
		font-weight: 500;
		color: #999;
	}

	.timeline-notes {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 0.85rem;
		color: #777;
		margin-top: 0.25rem;
		font-style: italic;
	}

	@media (max-width: 480px) {
		.params {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
