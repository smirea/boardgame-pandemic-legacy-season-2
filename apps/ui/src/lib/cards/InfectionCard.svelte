<script lang="ts">
	import { getContext } from 'svelte';
	import { cityDef, pack } from '@repo/game';
	import type { CardId, InfectionCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import MapArt from './MapArt.svelte';
	import { mapArt } from './mapArt.ts';

	const hoverCard = getContext<((card: CardId | null) => void) | undefined>('card-hover');

	type Props = { card: InfectionCard; onclick?: () => void; note?: string };

	let { card, onclick, note }: Props = $props();

	const city = $derived(card.kind === 'city' ? cityDef(card.city) : null);
	const accent = $derived(city ? CITY_COLOR[city.color ?? 'haven'] : '#8f74ad');
	const improvement = $derived(
		card.kind === 'city' ? pack.infectionImprovements.find(item => item.id === card.improvement) : undefined,
	);
	$effect(() => () => hoverCard?.(null));
</script>

<div
	class="wrap"
	role="presentation"
	onpointerenter={() => hoverCard?.(card.id)}
	onpointerleave={() => hoverCard?.(null)}
>
	<button
		class="card"
		style:--accent={accent}
		disabled={!onclick}
		{onclick}
		title={improvement?.text}
		onfocus={() => hoverCard?.(card.id)}
		onblur={() => hoverCard?.(null)}
	>
		{#if card.kind === 'city' && city}
			<span class="art"><MapArt city={card.city} {accent} tone="night" /></span>
			<span class="plate">
				<span class="kicker">Infection</span>
				<span class="title">{city.name}</span>
				<span class="meta">{mapArt(card.city).coordinates}</span>
			</span>
			{#if improvement}<span class="badge">{improvement.name}</span>{/if}
		{:else}
			<span class="hollow">
				<span class="kicker">Infection</span>
				<span class="title">{card.kind === 'gather' ? 'Hollow Men gather' : 'Hollow Men assemble'}</span>
				<span class="meta">The next city flipped gets a figure instead of an infection.</span>
			</span>
		{/if}
		{#if note}<span class="note">{note}</span>{/if}
	</button>
</div>

<style>
	/* Infection cards are the dark half of the table: a night chart with the city's region colour as its pin. */
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

	.art {
		position: absolute;
		inset: 0;
	}

	.plate,
	.hollow {
		position: absolute;
		inset: auto 0 0 0;
		display: flex;
		flex-direction: column;
		padding: 1em 0.6em 0.4em;
		background: linear-gradient(to top, var(--deep) 55%, transparent);
	}

	.hollow {
		inset: 0;
		justify-content: center;
		gap: 0.2em;
		background: repeating-linear-gradient(135deg, #1f1a24 0 0.5em, #261f2d 0.5em 1em);
	}

	.kicker {
		color: var(--tint);
		font-size: 0.66em;
		font-weight: 600;
	}

	.title {
		font-family: var(--font-display);
		font-size: 1.2em;
		line-height: 1.05;
	}

	.meta {
		color: rgb(236 226 205 / 0.55);
		font-size: 0.62em;
		line-height: 1.3;
	}

	.badge,
	.note {
		position: absolute;
		top: 0.4em;
		padding: 0.05em 0.45em;
		border-radius: 0.15em;
		font-size: 0.64em;
		font-weight: 600;
	}

	.badge {
		left: 0.4em;
		background: var(--accent);
		color: #f1e9d6;
	}

	.note {
		right: 0.4em;
		background: #e7dcc6;
		color: #2a2017;
	}
</style>
