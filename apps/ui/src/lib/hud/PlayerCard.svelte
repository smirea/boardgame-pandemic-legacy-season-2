<script lang="ts">
	import { cityDef, pack } from '@repo/game';
	import type { PlayerCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';

	type Props = { card: PlayerCard; onclick?: () => void; tone?: 'play' | 'discard' | null; small?: boolean };

	let { card, onclick, tone = null, small = false }: Props = $props();

	const face = $derived.by(() => {
		switch (card.kind) {
			case 'city': {
				const city = cityDef(card.city);
				const improvement = pack.cityImprovements.find(item => item.id === card.improvement);
				return {
					title: city.name,
					kicker: city.port ? 'Port city' : 'City',
					color: CITY_COLOR[city.color ?? 'haven'],
					text: improvement?.text ?? '',
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
				return { title: 'Epidemic', kicker: '', color: '#ff3b6b', text: '' };
		}
	});
</script>

<button
	class="card"
	class:small
	class:play={tone === 'play'}
	class:discard={tone === 'discard'}
	style:--band={face.color}
	disabled={!onclick}
	{onclick}
	title={face.text}
>
	<span class="band"></span>
	<span class="kicker">{face.kicker}</span>
	<span class="title">{face.title}</span>
	{#if !small && face.text}<span class="text">{face.text}</span>{/if}
	{#if card.kind === 'city' && card.search.length}
		<span class="boxes">
			{#each card.search as box, index (index)}
				<span class="box" class:used={box.scratched} title={`${box.scope} search`}
					>{box.scope === 'sea' ? '≈' : '⌕'}</span
				>
			{/each}
		</span>
	{/if}
</button>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		width: 6rem;
		height: 7.1rem;
		flex: none;
		padding: 0.9rem 0.5rem 0.45rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.5rem;
		background: linear-gradient(170deg, #1d2732, #121920);
		color: var(--ink);
		text-align: left;
		overflow: hidden;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease,
			border-color 160ms ease;
	}

	.card.small {
		width: 5.6rem;
		height: 3.1rem;
		padding-top: 0.7rem;
	}

	.card:not(:disabled) {
		cursor: pointer;
	}

	.card:not(:disabled):hover {
		transform: translateY(-0.5rem);
		box-shadow: 0 0.6rem 1.2rem rgb(0 0 0 / 0.45);
	}

	.card.play {
		border-color: var(--accent);
	}

	.card.discard {
		border-color: var(--danger);
	}

	.band {
		position: absolute;
		inset: 0 0 auto 0;
		height: 0.45rem;
		background: var(--band);
	}

	.kicker {
		color: var(--muted);
		font-size: 0.56rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.title {
		font-size: 0.82rem;
		font-weight: 650;
		line-height: 1.15;
	}

	.text {
		margin-top: auto;
		color: var(--muted);
		font-size: 0.58rem;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.boxes {
		position: absolute;
		right: 0.4rem;
		top: 0.75rem;
		display: flex;
		gap: 0.15rem;
	}

	.box {
		display: grid;
		place-items: center;
		width: 0.95rem;
		height: 0.95rem;
		border: 1px solid var(--warn);
		border-radius: 0.2rem;
		color: var(--warn);
		font-size: 0.6rem;
	}

	.box.used {
		border-color: var(--muted);
		color: var(--muted);
		opacity: 0.5;
	}
</style>
