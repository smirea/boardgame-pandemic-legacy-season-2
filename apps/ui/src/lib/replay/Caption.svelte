<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { TimelineStep } from './replay.svelte.ts';

	type Props = { step: TimelineStep | null; color: string | null };

	let { step, color }: Props = $props();
	// The game's own log repeats the step's label for some steps. A result line only earns space when it adds something.
	const results = $derived(
		(step?.results ?? []).filter(line => line.tone !== 'head' && line.text !== step?.text).slice(0, 3),
	);
</script>

{#if step}
	{#key step.frame}
		<div
			class="caption"
			style:--who={color ?? 'var(--paper-muted)'}
			in:fly={{ y: 8, duration: 220 }}
			data-testid="caption"
		>
			<p class="line">
				{#if step.who}<strong>{step.who}</strong>{/if}
				<span>{step.text}</span>
				{#if step.by}<small>{step.by}</small>{/if}
			</p>
			{#if results.length}
				<p class="results">
					{#each results as line (line)}<span class={line.tone}>{line.text}</span>{/each}
				</p>
			{/if}
		</div>
	{/key}
{/if}

<style>
	.caption {
		position: absolute;
		bottom: 0.8rem;
		left: 50%;
		z-index: 34;
		max-width: min(36rem, calc(100% - 35rem));
		padding: 0.4rem 0.9rem 0.45rem 0.8rem;
		border-left: 0.35rem solid var(--who);
		border-radius: 2px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		transform: translateX(-50%);
		pointer-events: none;
	}

	.line {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.25;
	}

	.line span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		flex: none;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 400;
	}

	small {
		flex: none;
		margin-left: auto;
		padding-left: 0.6rem;
		color: var(--slip-muted);
		font-size: 0.75rem;
	}

	.results {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.8rem;
		margin: 0.15rem 0 0;
		color: var(--slip-muted);
		font-size: 0.78rem;
	}

	.results .bad {
		color: var(--ink-danger);
	}

	.results .good {
		color: var(--ink-good);
	}
</style>
