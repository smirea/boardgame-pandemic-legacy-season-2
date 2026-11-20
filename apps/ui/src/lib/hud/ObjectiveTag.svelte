<script lang="ts" module>
	import type { ObjectiveDef, ObjectiveId } from '@repo/game';

	type Glyph = 'center' | 'recon' | 'connect' | 'haven' | 'search' | 'tower' | 'figure' | 'plan' | 'vial';

	/** What each objective is about, drawn as a small symbol beside its name and on each step of its track. */
	const GLYPH: Record<ObjectiveId, Glyph> = {
		prologueCenters: 'center',
		buildCenters: 'center',
		reconRegion: 'recon',
		reconNewArea: 'recon',
		reconEastAsia: 'recon',
		connectCities: 'connect',
		lostHaven: 'haven',
		searches: 'search',
		triangulate: 'tower',
		defect: 'figure',
		plan: 'plan',
		deliverSample: 'vial',
	};
</script>

<script lang="ts">
	import { objectiveScan, scan } from '#lib/scans.svelte.ts';
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';

	type Props = {
		objective: ObjectiveDef;
		progress?: number;
		done?: boolean;
		waived?: boolean;
		onclick?: () => void;
	};

	let { objective, progress = 0, done = false, waived = false, onclick }: Props = $props();
</script>

{#snippet glyph(kind: Glyph)}
	<svg viewBox="0 0 16 16" aria-hidden="true" class="glyph">
		{#if kind === 'center'}
			<path d="M2 8 8 2.5 14 8h-2v5.5H4V8Z" />
		{:else if kind === 'recon'}
			<circle cx="8" cy="8" r="5.5" fill="none" stroke-width="1.6" />
			<path d="M8 3.5 9.6 8 8 12.5 6.4 8Z" />
		{:else if kind === 'connect'}
			<circle cx="3.5" cy="12" r="2.2" /><circle cx="12.5" cy="4" r="2.2" />
			<path d="M3.5 12 12.5 4" fill="none" stroke-width="1.6" />
		{:else if kind === 'haven'}
			<path d="M8 1.8 13.4 4.9v6.2L8 14.2 2.6 11.1V4.9Z" />
		{:else if kind === 'search'}
			<circle cx="6.8" cy="6.8" r="4" fill="none" stroke-width="1.8" />
			<path d="m9.8 9.8 4 4" fill="none" stroke-width="2.2" stroke-linecap="round" />
		{:else if kind === 'tower'}
			<path d="M8 6 5 14h1.6L8 10l1.4 4H11Z" />
			<path d="M5 4.5a4 4 0 0 1 6 0M3.2 2.6a6.5 6.5 0 0 1 9.6 0" fill="none" stroke-width="1.3" />
		{:else if kind === 'figure'}
			<path d="M8 2 12.5 14h-9Z" />
		{:else if kind === 'plan'}
			<path d="M3 2h10v12H3Z" fill="none" stroke-width="1.5" />
			<path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" fill="none" stroke-width="1.3" />
		{:else}
			<path d="M6.5 2h3v4.2l3.4 6.2a1.2 1.2 0 0 1-1 1.6H4.1a1.2 1.2 0 0 1-1-1.6l3.4-6.2Z" />
		{/if}
	</svg>
{/snippet}

<button
	class="objective"
	class:done
	class:waived
	class:mandatory={objective.mandatory}
	disabled={!onclick || done || waived}
	title={`${objective.name}. ${objective.rule}${objective.mandatory ? ' Mandatory.' : ''}${progress && objective.target > 1 ? ` ${progress} of ${objective.target} done.` : ''}${onclick ? ' Click to mark it impossible this game.' : ''}`}
	{onclick}
	{@attach scan(() => objectiveScan(objective.id), `objective:${objective.id}`)}
>
	<span class="face">
		{@render glyph(GLYPH[objective.id])}
		<span class="name">{objective.name}</span>
		{#if done}
			<svg class="check" viewBox="0 0 16 16" aria-label="done" in:scale={{ duration: 420, easing: backOut }}>
				<path d="M2.5 8.5 6.2 12 13.5 4" />
			</svg>
		{:else if objective.target > 1}
			<span class="steps" aria-label={`${progress} of ${objective.target}`}>
				{#each { length: objective.target } as _, step (step)}
					<i class:on={step < progress}>{@render glyph(GLYPH[objective.id])}</i>
				{/each}
			</span>
		{:else}
			<span class="box" aria-label="not yet"></span>
		{/if}
	</span>
	{#if objective.mandatory}
		<span class="must">mandatory</span>
	{/if}
</button>

<style>
	/* Each objective is a paper tag: its symbol, its name, then its track. A finished one turns green and gets a check. */
	.objective {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 0.18rem 0.55rem 0.18rem 0.45rem;
		border: 0;
		border-radius: 2px;
		background: var(--slip);
		color: var(--slip-ink);
		font: inherit;
		white-space: nowrap;
		box-shadow: var(--slip-shadow);
		cursor: pointer;
		transition:
			translate 300ms cubic-bezier(0.2, 0.9, 0.3, 1.3),
			background 400ms ease,
			color 400ms ease;
	}

	.face {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.must {
		margin-top: -0.05rem;
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		line-height: 1.1;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.objective:hover:not(:disabled) {
		translate: 0 2px;
	}

	.objective:disabled {
		cursor: default;
	}

	.objective.mandatory {
		background: #f0dfb4;
	}

	.objective.done {
		background: #a9d0ae;
		color: #1f5134;
		animation: stamped 500ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	@keyframes stamped {
		from {
			scale: 1.25;
		}
	}

	.objective.waived {
		opacity: 0.45;
		text-decoration: line-through;
	}

	.glyph {
		width: 0.95rem;
		height: 0.95rem;
		flex: none;
		fill: currentcolor;
		stroke: currentcolor;
	}

	.steps {
		display: inline-flex;
		gap: 1px;
	}

	.steps i {
		display: flex;
		opacity: 0.28;
		transition:
			opacity 300ms ease,
			transform 300ms cubic-bezier(0.3, 1.6, 0.5, 1);
	}

	.steps i .glyph {
		width: 0.78rem;
		height: 0.78rem;
	}

	.steps i.on {
		opacity: 1;
		transform: scale(1.1);
	}

	.box {
		width: 0.7rem;
		height: 0.7rem;
		border: 1.5px solid currentcolor;
		border-radius: 1px;
		opacity: 0.6;
	}

	.check {
		width: 0.85rem;
		height: 0.85rem;
		fill: none;
		stroke: currentcolor;
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
