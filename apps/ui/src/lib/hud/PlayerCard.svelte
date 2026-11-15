<script lang="ts">
	import { cityDef, pack } from '@repo/game';
	import type { PlayerCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import MapArt from '#lib/cards/MapArt.svelte';

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
					color: CITY_COLOR[city.color ?? 'haven'],
					text: improvement?.text ?? '',
					badge: improvement?.name,
				};
			}
			case 'event': {
				const event = pack.events.find(item => item.id === card.event)!;
				return {
					title: event.name,
					kicker: card.mode === 'unrationed' ? 'Event, one use' : 'Event',
					color: '#c9a227',
					text: event.text,
				};
			}
			case 'companion': {
				const companion = pack.companions.find(item => item.id === card.companion)!;
				return { title: companion.name, kicker: 'Companion', color: '#8f6ad9', text: companion.text };
			}
			case 'produce':
				return {
					title: 'Produce Supplies',
					kicker: `${card.boxesLeft} system-wide left`,
					color: '#e8e2d0',
					text: 'At a haven or supply center: fill it, or every one, up to population.',
				};
			case 'epidemic':
				return {
					title: 'Epidemic',
					kicker: 'Increase, infect, intensify',
					color: '#ff3b6b',
					text: 'Raise the rate. Strip the bottom city. Restack the discards.',
				};
		}
	});
</script>

<button
	class="card {card.kind}"
	class:small
	class:play={tone === 'play'}
	class:discard={tone === 'discard'}
	style:--band={face.color}
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
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 8.2em;
		height: 9.7em;
		flex: none;
		padding: 0;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 0.6em;
		background: linear-gradient(170deg, #1d2732, #121920);
		color: var(--ink, #e9e6dc);
		font-size: var(--card-size, 0.73rem);
		text-align: left;
		overflow: hidden;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease,
			border-color 160ms ease;
	}

	.card.small {
		width: 7.6em;
		height: 3em;
	}

	.card:not(:disabled) {
		cursor: pointer;
	}

	.card:not(:disabled):hover {
		transform: translateY(-0.5rem);
		box-shadow: 0 0.6rem 1.2rem rgb(0 0 0 / 0.45);
	}

	.card.play {
		border-color: var(--accent, #7dfcc0);
		box-shadow: 0 0 0 1px var(--accent, #7dfcc0);
	}

	.card.discard {
		border-color: var(--danger, #ff6b6b);
		box-shadow: 0 0 0 1px var(--danger, #ff6b6b);
	}

	.head {
		display: flex;
		flex-direction: column;
		padding: 0.55em 0.6em 0.4em;
		border-top: 0.42em solid var(--band);
	}

	.kicker {
		color: var(--muted, #8a9aa8);
		font-size: 0.6em;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.title {
		font-size: 1.02em;
		font-weight: 700;
		line-height: 1.12;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.art {
		flex: 1;
		min-height: 0;
		border-block: 1px solid rgb(255 255 255 / 0.1);
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
		background: var(--band);
	}

	.badge {
		padding: 0 0.4em;
		border-radius: 0.3em;
		background: var(--band);
		color: #10161c;
		font-size: 0.58em;
		font-weight: 700;
	}

	.box {
		display: grid;
		place-items: center;
		width: 1.15em;
		height: 1.15em;
		border: 1px solid var(--warn, #ffd166);
		border-radius: 0.25em;
		color: var(--warn, #ffd166);
		font-size: 0.72em;
	}

	.box.used {
		border-color: var(--muted, #8a9aa8);
		color: var(--muted, #8a9aa8);
		opacity: 0.5;
	}

	.glyph {
		display: grid;
		place-items: center;
		flex: 1;
		min-height: 0;
		background: radial-gradient(circle, color-mix(in srgb, var(--band) 24%, transparent), transparent 70%);
		color: var(--band);
		font-size: 2.3em;
		line-height: 1;
	}

	.text {
		padding: 0.3em 0.6em 0.55em;
		color: var(--muted, #8a9aa8);
		font-size: 0.6em;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.epidemic {
		background: linear-gradient(170deg, #3a1020, #1a0810);
	}
</style>
