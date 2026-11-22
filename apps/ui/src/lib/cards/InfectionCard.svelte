<script lang="ts">
	import { getContext } from 'svelte';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef, pack } from '@repo/game';
	import type { CardId, InfectionCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import RichText from '#lib/hud/RichText.svelte';
	import MapArt from './MapArt.svelte';
	import { fitText } from './fit.ts';

	const hoverCard = getContext<((card: CardId | null) => void) | undefined>('card-hover');

	type Props = { card: InfectionCard; onclick?: () => void; note?: string; alarm?: boolean };

	let { card, onclick, note, alarm = false }: Props = $props();

	const city = $derived(card.kind === 'city' ? cityDef(card.city) : null);
	const accent = $derived(city ? CITY_COLOR[city.color ?? 'haven'] : '#8f74ad');
	const improvement = $derived(
		card.kind === 'city' ? pack.infectionImprovements.find(item => item.id === card.improvement) : undefined,
	);
	const hollowTitle = $derived(card.kind === 'gather' ? 'Hollow Men gather' : 'Hollow Men assemble');
	const hollowRule =
		'Discard this card and flip again until you reach a city. Place a Hollow Man there instead of infecting it.';
	$effect(() => () => hoverCard?.(null));
</script>

<div
	class="wrap"
	role="presentation"
	onpointerenter={() => hoverCard?.(card.id)}
	onpointerleave={() => hoverCard?.(null)}
	{@attach feedback('Infection card', () => ({ card: card.id, kind: card.kind, improvement: improvement?.id }))}
>
	<button
		class="card"
		class:improved={!!improvement}
		style:--accent={accent}
		disabled={!onclick}
		{onclick}
		onfocus={() => hoverCard?.(card.id)}
		onblur={() => hoverCard?.(null)}
	>
		{#if card.kind === 'city' && city}
			<span class="art"><MapArt city={card.city} {accent} tone="night" /></span>
			<span class="plate">
				<span class="title" {@attach fitText(city.name, { max: 1.24, min: 0.72, across: true })}>{city.name}</span>
			</span>
			{#if improvement}
				<span class="improvement" {@attach feedback('Infection improvement', () => ({ id: improvement?.id }))}>
					<strong class="improvement-name">{improvement.name}</strong>
					<span class="rule" {@attach fitText(improvement.text, { min: 0.52, max: 0.84 })}>
						<RichText text={improvement.text} />
					</span>
				</span>
			{/if}
		{:else}
			<span class="hollow">
				<span class="title" {@attach fitText(hollowTitle, { max: 1.2, min: 0.72, across: true })}>{hollowTitle}</span>
				<span class="hollow-rule" {@attach fitText(hollowRule, { min: 0.55, max: 0.86 })}>
					<RichText text={hollowRule} />
				</span>
			</span>
		{/if}
		{#if note}<span class="note" class:alarm>{note}</span>{/if}
	</button>
</div>

<style>
	.card {
		--tint: color-mix(in srgb, var(--accent) 55%, #f3e9d4);
		--deep: color-mix(in srgb, var(--accent) 55%, #120d09);
		position: relative;
		display: block;
		width: 11em;
		height: 7.2em;
		flex: none;
		padding: 0;
		border: 1px solid var(--accent);
		border-radius: 0.4em;
		background: var(--deep);
		color: #ece2cd;
		font-family: var(--font-ui);
		font-size: var(--card-size, 0.72rem);
		text-align: left;
		overflow: hidden;
		box-shadow: 0 0.3em 0.9em rgb(0 0 0 / 0.5);
	}

	.card:not(:disabled) {
		cursor: pointer;
	}

	.card :global(.glyphed) {
		white-space: normal;
	}

	.art {
		position: absolute;
		inset: 0;
	}

	.improved .art {
		inset: 0 0 auto;
		height: 2.6em;
	}

	.improved .plate {
		inset: 0 0 auto;
		padding: 0.38em 0.6em 0.5em;
		background: linear-gradient(to bottom, var(--deep) 45%, transparent);
	}

	.plate,
	.hollow {
		position: absolute;
		inset: auto 0 0 0;
		display: flex;
		flex-direction: column;
		padding: 1.1em 0.6em 0.48em;
		background: linear-gradient(to top, var(--deep) 55%, transparent);
	}

	.hollow {
		inset: 0;
		gap: 0.28em;
		padding: 0.52em 0.64em 0.56em;
		background: repeating-linear-gradient(135deg, #1f1a24 0 0.5em, #261f2d 0.5em 1em);
	}

	.hollow-rule {
		flex: 1;
		min-height: 0;
		line-height: 1.24;
		overflow: hidden;
	}

	.title {
		font-family: var(--font-display);
		line-height: 1.05;
		white-space: nowrap;
		overflow: hidden;
	}

	.improvement {
		position: absolute;
		inset: 2.15em 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.14em;
		padding: 0.34em 0.6em 0.4em;
		border-top: 1px solid var(--accent);
		background: color-mix(in srgb, var(--deep) 90%, #130e0c);
	}

	.improvement-name {
		color: var(--tint);
		font-size: 0.76em;
		line-height: 1.15;
	}

	.rule {
		flex: 1;
		min-height: 0;
		line-height: 1.16;
		overflow: hidden;
	}

	.note {
		position: absolute;
		top: 0.4em;
		right: 0.4em;
		padding: 0.05em 0.45em;
		border-radius: 0.15em;
		background: #e7dcc6;
		color: #2a2017;
		font-size: 0.64em;
		font-weight: 600;
	}

	.note.alarm {
		background: #a3271f;
		color: #fff4e6;
	}
</style>
