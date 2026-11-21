<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { flip } from 'svelte/animate';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import type { DrawnInfection } from './infectionShow.svelte.ts';

	type Props = {
		cards: DrawnInfection[];
		/** When set, a card can be drawn one at a time by clicking here or the Infection deck. */
		draw?: { left: number; busy: boolean; onclick: () => void } | null;
	};

	let { cards, draw = null }: Props = $props();

	/** The card leaves the active Infection draw deck (over hand or top bar), small and face down, and flips up as it lands. */
	function fromDeck(node: HTMLElement) {
		const deck = (
			document.querySelector('[data-testid="infection-draw-deck"] .pile-card') ??
			document.querySelector('[data-deck="infection"]')
		)?.getBoundingClientRect();
		const card = node.getBoundingClientRect();
		const dx = deck ? deck.left + deck.width / 2 - (card.left + card.width / 2) : 0;
		const dy = deck ? deck.top + deck.height / 2 - (card.top + card.height / 2) : -40;
		return {
			duration: 570,
			easing: cubicOut,
			css: (t: number) =>
				`transform: translate(${dx * (1 - t)}px, ${dy * (1 - t)}px) scale(${0.15 + 0.85 * t}) rotateY(${(1 - t) * 180}deg); opacity: ${Math.min(1, t * 3)}`,
		};
	}

	function away(_node: HTMLElement) {
		return {
			duration: 320,
			easing: cubicIn,
			css: (t: number) =>
				`transform: translate(${(1 - t) * 40}px, ${(1 - t) * 24}px) scale(${0.85 + t * 0.15}); opacity: ${t}`,
		};
	}
</script>

{#if cards.length || draw}
	<div
		class="drawn-wrap"
		data-testid="infection-draw"
		{@attach feedback('Infection draw stack', () => ({ count: cards.length, left: draw?.left ?? 0 }))}
	>
		{#if draw}
			<button
				class="draw-next"
				class:pulsing={!draw.busy}
				disabled={draw.busy}
				onclick={draw.onclick}
				data-testid="infection-draw-next"
				aria-label={`Flip next Infection card (${draw.left} left)`}
			>
				<span class="bio" aria-hidden="true">☣</span>
				<span>{draw.busy ? 'Infecting…' : `Flip Infection (${draw.left} left)`}</span>
			</button>
		{/if}
		{#if cards.length}
			<div class="stack">
				{#each cards as entry, index (entry.key)}
					<div class="layer" style:--z={cards.length - index} animate:flip={{ duration: 360 }} in:fromDeck out:away>
						<InfectionCard card={entry.card} note={entry.note} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Under the top bar's right end, where the Infection deck sits, above the seats and panels. */
	.drawn-wrap {
		position: fixed;
		top: 3.4rem;
		right: 1.2rem;
		z-index: 60;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.45rem;
		--card-size: 1rem;
		pointer-events: none;
	}

	.draw-next {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.38rem 0.85rem;
		border: 1.5px solid #93b236;
		border-radius: 4px;
		background: rgb(26 22 30 / 0.94);
		color: var(--paper);
		font: inherit;
		font-size: 0.86rem;
		font-weight: 700;
		cursor: pointer;
		pointer-events: auto;
		box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 0.55);
		transition:
			transform 180ms ease,
			border-color 180ms ease;
	}

	.draw-next:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.draw-next.pulsing {
		animation: infectPulse 1.6s ease-in-out infinite;
	}

	.draw-next.pulsing:hover {
		transform: scale(1.04);
		border-color: #b8dc4c;
	}

	@keyframes infectPulse {
		0%,
		100% {
			box-shadow: 0 0.4rem 1rem rgb(147 178 54 / 0.3);
		}
		50% {
			box-shadow: 0 0.5rem 1.8rem rgb(147 178 54 / 0.8);
		}
	}

	.bio {
		color: #93b236;
		font-size: 1.05rem;
		line-height: 1;
	}

	/* Each card stacks with the newest on top and older cards peeking out below so every city name stays visible. */
	.stack {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		perspective: 40rem;
	}

	.layer {
		position: relative;
		z-index: var(--z);
		pointer-events: auto;
		transition: transform 180ms ease;
	}

	.layer + .layer {
		margin-top: -4.55em;
	}

	.layer:hover {
		z-index: 40;
		transform: translateX(-0.6rem);
	}
</style>
