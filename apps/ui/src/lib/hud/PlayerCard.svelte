<script lang="ts" module>
	import { cityDef } from '@repo/game';
	import type { PlayerCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';

	const KIND_COLOR = { event: '#b08628', companion: '#6f5a96', produce: '#8d8476', epidemic: '#a8261c' } as const;

	/** The colour a card is known by at a glance: its city's region, or its kind. */
	export const cardColor = (card: PlayerCard) =>
		card.kind === 'city' ? CITY_COLOR[cityDef(card.city).color ?? 'haven'] : KIND_COLOR[card.kind];
</script>

<script lang="ts">
	import { getContext } from 'svelte';
	import type { CardId } from '@repo/game';
	import { pack } from '@repo/game';
	import MapArt from '#lib/cards/MapArt.svelte';
	import { inkOn } from '#lib/color.ts';

	const hoverCard = getContext<((card: CardId | null) => void) | undefined>('card-hover');

	type Props = { card: PlayerCard; onclick?: () => void; tone?: 'play' | 'discard' | null; small?: boolean };

	let { card, onclick, tone = null, small = false }: Props = $props();

	const GLYPH = { event: '✦', companion: '☻', produce: '▦', epidemic: '☣' } as const;

	const face = $derived.by(() => {
		switch (card.kind) {
			case 'city': {
				const city = cityDef(card.city);
				const improvement = pack.cityImprovements.find(item => item.id === card.improvement);
				return {
					title: city.name,
					kicker: city.port ? 'Port' : 'City',
					color: cardColor(card),
					text: improvement?.text ?? '',
					badge: improvement?.name,
				};
			}
			case 'event': {
				const event = pack.events.find(item => item.id === card.event)!;
				return {
					title: event.name,
					kicker: card.mode === 'unrationed' ? 'Event, one use' : 'Event',
					color: cardColor(card),
					text: event.text,
				};
			}
			case 'companion': {
				const companion = pack.companions.find(item => item.id === card.companion)!;
				return { title: companion.name, kicker: 'Companion', color: cardColor(card), text: companion.text };
			}
			case 'produce':
				return {
					title: 'Produce Supplies',
					kicker: `${card.boxesLeft} system-wide left`,
					color: cardColor(card),
					text: 'At a haven or supply center: fill it, or every one, up to population.',
				};
			case 'epidemic':
				return {
					title: 'Epidemic',
					kicker: 'Increase, infect, intensify',
					color: cardColor(card),
					text: 'Raise the rate. Strip the bottom city. Restack the discards.',
				};
		}
	});
</script>

<button
	class="card {card.kind}"
	onmouseenter={() => hoverCard?.(card.id)}
	onmouseleave={() => hoverCard?.(null)}
	onfocus={() => hoverCard?.(card.id)}
	onblur={() => hoverCard?.(null)}
	class:small
	class:play={tone === 'play'}
	class:discard={tone === 'discard'}
	style:--band={face.color}
	style:--on={inkOn(face.color)}
	disabled={!onclick}
	{onclick}
	title={face.text}
>
	<span class="head">
		<span class="kicker">{face.kicker}</span>
		<span class="title">{face.title}</span>
	</span>
	{#if !small}
		{#if card.kind === 'city'}
			<span class="art"><MapArt city={card.city} accent={face.color} /></span>
			<span class="foot">
				<span class="pips" title="Population when the campaign began">
					{#each { length: cityDef(card.city).population } as _, index (index)}<i></i>{/each}
				</span>
				{#if face.badge}<span class="badge" title={face.text}>{face.badge}</span>{/if}
				{#each card.search as box, index (index)}
					<span class="box" class:used={box.scratched} title={`${box.scope} search${box.scratched ? ', used' : ''}`}
						>{box.scope === 'sea' ? '≈' : '⌕'}</span
					>
				{/each}
			</span>
		{:else}
			<span class="glyph">{GLYPH[card.kind]}</span>
			<span class="text">{face.text}</span>
		{/if}
	{/if}
</button>

<style>
	/* A player card is printed solid in its region's colour, with the map inset like a plate on the front. */
	.card {
		--soft: color-mix(in srgb, var(--on) 72%, transparent);
		position: relative;
		display: flex;
		flex-direction: column;
		width: 8.2em;
		height: 9.7em;
		flex: none;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--band) 55%, #000);
		border-radius: 0.4em;
		background:
			radial-gradient(ellipse at 20% 0%, rgb(255 248 228 / 0.22), transparent 60%),
			linear-gradient(172deg, var(--band), color-mix(in srgb, var(--band) 80%, #140c06));
		color: var(--on);
		font-family: var(--font-ui);
		font-size: var(--card-size, 0.73rem);
		text-align: left;
		overflow: hidden;
		box-shadow:
			inset 0 0 0 0.22em rgb(255 248 228 / 0.14),
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
		transition:
			box-shadow 200ms ease,
			outline-color 200ms ease;
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	.card.small {
		width: 7.6em;
		height: 3em;
	}

	.card:not(:disabled) {
		cursor: pointer;
	}

	.card.play {
		outline-color: var(--warn);
	}

	.card.discard {
		outline-color: var(--danger);
	}

	.head {
		display: flex;
		flex-direction: column;
		padding: 0.5em 0.6em 0.35em;
	}

	.kicker {
		color: var(--soft);
		font-size: 0.66em;
		font-weight: 600;
	}

	.title {
		display: -webkit-box;
		font-family: var(--font-display);
		font-size: 1.18em;
		line-height: 1.02;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.art {
		flex: 1;
		min-height: 0;
		margin: 0 0.4em;
		border: 1px solid rgb(0 0 0 / 0.3);
		border-radius: 0.15em;
		overflow: hidden;
		box-shadow: 0 0 0 0.12em rgb(255 248 228 / 0.35);
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 0.3em;
		height: 1.7em;
		padding: 0 0.5em;
	}

	.pips {
		display: flex;
		gap: 0.16em;
		margin-right: auto;
	}

	.pips i {
		width: 0.42em;
		height: 0.42em;
		border-radius: 50%;
		background: var(--on);
	}

	.badge {
		padding: 0 0.4em;
		border-radius: 0.15em;
		background: var(--on);
		color: var(--band);
		font-size: 0.62em;
		font-weight: 700;
	}

	.box {
		display: grid;
		place-items: center;
		width: 1.15em;
		height: 1.15em;
		border: 1px solid var(--on);
		border-radius: 0.15em;
		font-size: 0.72em;
	}

	.box.used {
		opacity: 0.35;
	}

	.glyph {
		display: grid;
		place-items: center;
		flex: 1;
		min-height: 0;
		color: var(--on);
		font-size: 2.3em;
		line-height: 1;
		opacity: 0.9;
	}

	.text {
		padding: 0.3em 0.6em 0.55em;
		color: var(--soft);
		font-size: 0.66em;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
