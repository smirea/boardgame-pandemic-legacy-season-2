<script lang="ts">
	import { cityDef, pack } from '@repo/game';
	import type { InfectionCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import MapArt from './MapArt.svelte';
	import { mapArt } from './mapArt.ts';

	type Props = { card: InfectionCard; onclick?: () => void; note?: string };

	let { card, onclick, note }: Props = $props();

	const city = $derived(card.kind === 'city' ? cityDef(card.city) : null);
	const accent = $derived(city ? CITY_COLOR[city.color ?? 'haven'] : '#b48cff');
	const improvement = $derived(
		card.kind === 'city' ? pack.infectionImprovements.find(item => item.id === card.improvement) : undefined,
	);
</script>

<button class="card" style:--accent={accent} disabled={!onclick} {onclick} title={improvement?.text}>
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

<style>
	.card {
		position: relative;
		display: block;
		width: 11em;
		height: 7.2em;
		flex: none;
		padding: 0;
		border: 0.12em solid var(--accent);
		border-radius: 0.55em;
		background: #0b1512;
		color: #f1ede2;
		font-size: var(--card-size, 0.72rem);
		text-align: left;
		overflow: hidden;
		box-shadow: 0 0.3em 0.9em rgb(0 0 0 / 0.45);
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
		padding: 0.9em 0.6em 0.4em;
		background: linear-gradient(to top, rgb(5 9 8 / 0.95) 55%, transparent);
	}

	.hollow {
		inset: 0;
		justify-content: center;
		gap: 0.2em;
		background: repeating-linear-gradient(135deg, #1a1326 0 0.6em, #221833 0.6em 1.2em);
	}

	.kicker {
		color: var(--accent);
		font-size: 0.6em;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.title {
		font-size: 1.05em;
		font-weight: 700;
		line-height: 1.1;
	}

	.meta {
		color: rgb(255 255 255 / 0.55);
		font-size: 0.58em;
		line-height: 1.3;
	}

	.badge,
	.note {
		position: absolute;
		top: 0.4em;
		padding: 0.05em 0.45em;
		border-radius: 0.3em;
		font-size: 0.6em;
		font-weight: 700;
	}

	.badge {
		left: 0.4em;
		background: var(--accent);
		color: #0b1512;
	}

	.note {
		right: 0.4em;
		background: rgb(5 9 8 / 0.85);
		color: #f1ede2;
	}
</style>
