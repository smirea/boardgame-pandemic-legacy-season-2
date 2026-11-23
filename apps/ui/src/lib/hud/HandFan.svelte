<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { PlayerCard as PlayerCardType } from '@repo/game';
	import PlayerCard from './PlayerCard.svelte';

	type Props = {
		label: string;
		cards: PlayerCardType[];
		/** The em the cards are drawn in. */
		size: string;
		testid?: string;
	};

	let { label, cards, size, testid }: Props = $props();

	// Fanned as a player holds their own hand: tighter the more cards there are.
	const angle = (index: number) => (index - (cards.length - 1) / 2) * Math.min(4.5, 22 / cards.length);
</script>

{#if cards.length}
	<div
		class="fan"
		style:--card-size={size}
		style:--overlap={`${Math.max(0.6, Math.min(4, (cards.length - 2) * 0.7))}em`}
		role="group"
		aria-label={label}
		data-testid={testid}
		{@attach feedback(undefined, () => ({ label, count: cards.length }))}
	>
		{#each cards as card, index (card.id)}
			<div class="lift" style:--angle={`${angle(index)}deg`} style:--drop={`${Math.abs(angle(index)) * 0.06}rem`}>
				<PlayerCard {card} />
			</div>
		{/each}
	</div>
{/if}

<style>
	/* No tray: each card carries its own shadow onto the map. */
	.fan {
		display: flex;
		justify-content: center;
		padding-inline: calc(var(--overlap) / 2);
		font-size: var(--card-size);
		pointer-events: none;
	}

	.lift {
		margin-inline: calc(var(--overlap) / -2);
		filter: drop-shadow(0 0.45rem 0.7rem rgb(0 0 0 / 0.5));
		transform: translateY(var(--drop)) rotate(var(--angle));
		transform-origin: 50% 140%;
	}
</style>
