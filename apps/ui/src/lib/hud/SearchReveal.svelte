<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { searchFind } from '@repo/game';
	import type { PlayerCard as Card } from '@repo/game';
	import { backOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';
	import { inkOn } from '#lib/color.ts';
	import PlayerCard from './PlayerCard.svelte';

	type Props = {
		who: string;
		color: string;
		city: string;
		card: Card & { kind: 'city' };
		box: number;
		onclose: () => void;
	};

	let { who, color, city, card, box, onclose }: Props = $props();

	const searched = $derived(card.search[box]!);
	const found = $derived(searchFind(searched.result));
</script>

<!--
	A search is the one action whose outcome is hidden until it is taken, so the whole table sees the box scratched open
	on the card itself. It takes the pointer only to be put away; the card keeps the result printed after it goes.
-->
<button
	type="button"
	class="reveal"
	style:--seat={color}
	style:--on={inkOn(color)}
	aria-label={`${who} searched ${city}: ${found}. Dismiss`}
	onclick={onclose}
	in:scale={{ start: 0.8, duration: 380, easing: backOut }}
	out:fade={{ duration: 260 }}
	{@attach feedback('Search result', () => ({ who, city, box, result: searched.result }))}
>
	<span class="head">
		<span class="who">{who}</span>
		<span class="verb">{searched.scope === 'sea' ? 'searched the sea at' : 'searched'} {city}</span>
	</span>
	<span class="body">
		<span class="card"><PlayerCard {card} revealing={box} /></span>
		<span class="found">
			<span class="kicker">Found</span>
			<strong>{found}</strong>
		</span>
	</span>
</button>

<style>
	.reveal {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.7rem 0.9rem 0.85rem;
		border: 1px solid color-mix(in srgb, var(--seat) 70%, var(--line));
		border-radius: 0.5rem;
		background: var(--panel-solid);
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 0.3),
			0 1rem 2.4rem rgb(0 0 0 / 0.45);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 0.86rem;
	}

	.who {
		padding: 0.05rem 0.4rem;
		border-radius: 0.2rem;
		background: var(--seat);
		color: var(--on);
		font-weight: 800;
	}

	.verb {
		color: var(--muted, inherit);
	}

	.body {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.card {
		--card-size: 1.05rem;
		pointer-events: none;
	}

	.found {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-width: 12rem;
	}

	.kicker {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.found strong {
		font-size: 1.1rem;
		line-height: 1.25;
		animation: arrive 500ms 900ms ease-out both;
	}

	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(0.3rem);
		}
	}
</style>
