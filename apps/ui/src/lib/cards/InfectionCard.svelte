<script lang="ts">
	import { getContext } from 'svelte';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef } from '@repo/game';
	import type { CardId, InfectionCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import RichText from '#lib/hud/RichText.svelte';
	import { infectionCardScan, originals, scanUrl } from '#lib/scans.svelte.ts';
	import MapArt from './MapArt.svelte';
	import { fitText } from './fit.ts';
	import { mapArt } from './mapArt.ts';
	import { INFECTION_IMPROVEMENT_PRINT } from './playerPrint.ts';

	const hoverCard = getContext<((card: CardId | null) => void) | undefined>('card-hover');

	type Props = { card: InfectionCard; onclick?: () => void; note?: string; alarm?: boolean };

	let { card, onclick, note, alarm = false }: Props = $props();

	const city = $derived(card.kind === 'city' ? cityDef(card.city) : null);
	const accent = $derived(city ? CITY_COLOR[city.color ?? 'haven'] : '#8f74ad');
	const improvement = $derived(
		card.kind === 'city' && card.improvement
			? { id: card.improvement, ...INFECTION_IMPROVEMENT_PRINT[card.improvement] }
			: undefined,
	);
	const originalScan = $derived(infectionCardScan(card));
	const cardTitle = $derived(
		card.kind === 'city' && city ? city.name : card.kind === 'gather' ? 'Hollow Men gather' : 'Hollow Men assemble',
	);
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
		data-card={card.id}
		data-original-active={originals.held && Boolean(originalScan)}
		style:--accent={accent}
		disabled={!onclick}
		{onclick}
		onfocus={() => hoverCard?.(card.id)}
		onblur={() => hoverCard?.(null)}
	>
		{#if originals.held && originalScan}
			<span class="original-frame">
				<img
					class="original-swap"
					class:rotated={Boolean(originalScan.card.rotated)}
					src={scanUrl(originalScan.card.src)}
					alt={cardTitle}
				/>
				{#if originalScan.sticker}
					<img class="original-sticker" src={scanUrl(originalScan.sticker.src)} alt={originalScan.sticker.title} />
				{/if}
			</span>
		{:else if card.kind === 'city' && city}
			<span class="art"><MapArt city={card.city} {accent} tone="night" /></span>
			<span class="plate">
				<span class="kicker">Infection</span>
				<span class="title">{city.name}</span>
				{#if !improvement}<span class="meta">{mapArt(card.city).coordinates}</span>{/if}
			</span>
			{#if improvement}
				<span class="improvement" {@attach feedback('Infection improvement', () => ({ id: improvement?.id }))}>
					<strong class="improvement-name">{improvement.name}</strong>
					<span class="rule" {@attach fitText(improvement.text, { min: 0.57, max: 0.85 })}>
						<RichText text={improvement.text} />
					</span>
				</span>
			{/if}
		{:else}
			<span class="hollow">
				<span class="kicker">Infection</span>
				<span class="title">{cardTitle}</span>
				<span class="hollow-rule" {@attach fitText(hollowRule, { min: 0.65, max: 0.86 })}>
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

	.card.improved,
	.card:has(.hollow) {
		height: 9em;
	}

	.card[data-original-active='true'] {
		display: grid;
		place-items: center;
		background: #14110e;
	}

	.original-frame {
		position: relative;
		width: 100%;
		max-height: 100%;
		aspect-ratio: 571 / 410;
		overflow: hidden;
	}

	.original-swap {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.original-swap.rotated {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 71.8%;
		height: 139.3%;
		transform: translate(-50%, -50%) rotate(-90deg);
		object-fit: cover;
	}

	.original-sticker {
		position: absolute;
		left: 11%;
		top: 58%;
		width: 78%;
		height: auto;
		transform: translateY(-50%);
		border-radius: 0.16em;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.55);
		pointer-events: none;
	}

	.art {
		position: absolute;
		inset: 0;
	}

	.improved .art {
		inset: 0 0 auto;
		height: 3.5em;
	}

	.improved .plate {
		inset: 0 0 auto;
		padding-top: 0.45em;
		background: linear-gradient(to bottom, var(--deep), transparent);
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
		gap: 0.2em;
		padding-top: 0.45em;
		background: repeating-linear-gradient(135deg, #1f1a24 0 0.5em, #261f2d 0.5em 1em);
	}

	.hollow-rule {
		flex: 1;
		min-height: 0;
		line-height: 1.22;
	}

	.kicker {
		color: var(--tint);
		font-size: 0.66em;
		font-weight: 600;
		line-height: 1.2;
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

	.improvement {
		position: absolute;
		inset: 2.95em 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.12em;
		padding: 0.34em 0.6em;
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
		line-height: 1.14;
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
