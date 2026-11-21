<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import { fitText } from '#lib/cards/fit.ts';
	import type { LegacyPrint } from '#lib/cards/print.generated.ts';

	type Props = { card: LegacyCardDef; print: LegacyPrint; code: string; monthLabel: string; campaign?: Campaign };

	let { card, monthLabel }: Props = $props();

	const previous = $derived(pack.legacyDeck[pack.legacyDeck.findIndex(entry => entry.id === card.id) - 1]);
	const gate = $derived(previous?.halt);
	const type = $derived(gate === 'finale' ? 'stop' : (gate ?? card.kind));
	const label = $derived.by(() => {
		switch (type) {
			case 'stop':
				return 'Stop';
			case 'pause':
				return 'Pause';
			case 'prologue':
				return 'Prologue';
			case 'priorities':
				return 'New priorities';
			case 'turningPoint':
				return 'Turning point';
			default:
				return null;
		}
	});
	const instruction = $derived.by(() => {
		if (gate === 'finale') return 'Resume during Game End step 2 after a December win or a second December loss.';
		if (gate === 'stop') return `Resume during setup of the first ${monthLabel} game.`;
		if (gate === 'pause') return `Resume during Game End step 2 after the first ${monthLabel} game.`;
		if (type === 'prologue') return 'Leave the deck closed until the game tells you to open it.';
		if (type === 'turningPoint') return 'Keep this card in the Game End area.';
		return null;
	});
</script>

<div class="inner back {type}" {@attach feedback('Legacy card back', () => ({ card: card.id, gate }))}>
	<div class="emblem" aria-hidden="true">
		{#if type === 'stop'}
			<span class="stop-mark"></span>
		{:else if type === 'pause'}
			<span class="pause-mark"></span>
		{:else if type === 'objective'}
			<span class="target-mark"></span>
		{:else if type === 'event'}
			<span class="event-mark"></span>
		{:else if type === 'epidemic'}
			<span class="epidemic-mark"></span>
		{:else}
			<span class="compass-mark"></span>
		{/if}
	</div>
	{#if label}<strong class="title">{label}</strong>{/if}
	{#if instruction}
		<p class="instruction" {@attach fitText(instruction, { min: 0.85, max: 1.04 })}>{instruction}</p>
	{/if}
</div>

<style>
	.back {
		--mark: #d4b886;
		--edge: color-mix(in srgb, var(--mark) 35%, transparent);
		align-items: center;
		justify-content: center;
		gap: 0.8em;
		background: radial-gradient(ellipse at center, color-mix(in srgb, var(--mark) 16%, #201a16), #181411 76%);
		color: #f4ebd8;
		text-align: center;
	}

	.back::before {
		position: absolute;
		inset: 0.55em;
		border: 1px solid var(--edge);
		border-radius: 0.3em;
		content: '';
		pointer-events: none;
	}

	.stop,
	.epidemic {
		--mark: #e57a69;
	}

	.pause {
		--mark: #f3bd55;
	}

	.objective {
		--mark: #8cb7ea;
	}

	.event {
		--mark: #a8cd9e;
	}

	.emblem {
		display: grid;
		flex: none;
		width: 5.2em;
		height: 5.2em;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 50%;
		color: var(--mark);
	}

	.emblem span {
		display: block;
		width: 3.2em;
		height: 3.2em;
	}

	.stop-mark {
		border-radius: 0.5em;
		background: currentColor;
	}

	.pause-mark {
		border-inline: 0.85em solid currentColor;
	}

	.target-mark {
		border: 0.2em solid currentColor;
		border-radius: 50%;
		background: radial-gradient(circle, currentColor 0 21%, transparent 23%);
	}

	.event-mark {
		background: currentColor;
		clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%, 50% 50%);
	}

	.epidemic-mark {
		background: currentColor;
		clip-path: polygon(50% 0, 100% 88%, 0 88%, 50% 0, 50% 30%, 23% 75%, 77% 75%, 50% 30%);
	}

	.compass-mark {
		background: currentColor;
		clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
	}

	.title {
		font-family: var(--font-display);
		font-size: 1.85em;
		font-weight: 400;
		line-height: 1.28;
	}

	.instruction {
		width: 100%;
		height: calc(4.5 * var(--fs));
		margin: 0;
		color: #e7dcc6;
		line-height: 1.3;
		text-wrap: balance;
	}

	:global(.legacy-card.size-mini) .back {
		padding: 0;
	}

	:global(.legacy-card.size-mini) .emblem {
		width: 7em;
		height: 7em;
	}

	:global(.legacy-card.size-mini) .emblem span {
		width: 4.2em;
		height: 4.2em;
	}

	:global(.legacy-card.size-mini) .title {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	:global(.legacy-card.size-mini) .instruction {
		display: none;
	}
</style>
