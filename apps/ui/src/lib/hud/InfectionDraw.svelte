<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { InfectionCard as Card } from '@repo/game';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';

	type Props = { drawn: { key: number; card: Card; note: string } | null };

	let { drawn }: Props = $props();

	/** The card leaves the Infection deck in the top bar, small and face down, and turns up as it lands. */
	function fromDeck(node: HTMLElement) {
		const deck = document.querySelector('[data-deck="infection"]')?.getBoundingClientRect();
		const card = node.getBoundingClientRect();
		const dx = deck ? deck.left + deck.width / 2 - (card.left + card.width / 2) : 0;
		const dy = deck ? deck.top + deck.height / 2 - (card.top + card.height / 2) : -40;
		return {
			duration: 380,
			easing: cubicOut,
			css: (t: number) =>
				`transform: translate(${dx * (1 - t)}px, ${dy * (1 - t)}px) scale(${0.15 + 0.85 * t}) rotateY(${(1 - t) * 160}deg); opacity: ${Math.min(1, t * 3)}`,
		};
	}

	function away(_node: HTMLElement) {
		return {
			duration: 220,
			easing: cubicIn,
			css: (t: number) =>
				`transform: translate(${(1 - t) * 40}px, ${(1 - t) * 24}px) scale(${0.85 + t * 0.15}); opacity: ${t}`,
		};
	}
</script>

{#if drawn}
	{#key drawn.key}
		<div
			class="drawn"
			data-testid="infection-draw"
			in:fromDeck
			out:away
			{@attach feedback('Infection card being drawn', () => ({ note: drawn.note }))}
		>
			<InfectionCard card={drawn.card} note={drawn.note} />
		</div>
	{/key}
{/if}

<style>
	/* Under the top bar's right end, where the Infection deck sits, above the seats and panels. */
	.drawn {
		position: fixed;
		top: 3.5rem;
		right: 1.2rem;
		z-index: 60;
		--card-size: 1.05rem;
		pointer-events: none;
		perspective: 40rem;
	}
</style>
