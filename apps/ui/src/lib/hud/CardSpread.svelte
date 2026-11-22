<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { InfectionCard as InfectionCardType, PlayerCard as PlayerCardType } from '@repo/game';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import PlayerCard from './PlayerCard.svelte';

	type Props = {
		label: string;
		cards: { player: PlayerCardType[] } | { infection: InfectionCardType[] };
		/** Cards to a row: three for a hand, or as many as keep a big pile about as wide as it is tall. */
		cols?: number;
		/** Laid out beside a tooltip, level with its top, on the side with room. */
		beside?: 'left' | 'right';
		/** The em the cards are drawn in. */
		size?: string;
		/** Where the spread comes in from, as a vertical offset. */
		from?: number;
		onselect?: () => void;
		class?: string;
		testid?: string;
	};

	let {
		label,
		cards,
		cols,
		beside,
		size = beside ? '0.6rem' : '0.78rem',
		from = 10,
		onselect,
		class: className = '',
		testid,
	}: Props = $props();

	// The side asked for, unless the cards would run off the screen there.
	let flipped = $state(false);
	const side = $derived(flipped ? (beside === 'left' ? 'right' : 'left') : beside);
	const keepOnScreen = (node: HTMLElement) => {
		const box = node.getBoundingClientRect();
		if (box.left < 0 || box.right > innerWidth) flipped = true;
	};

	const count = $derived('player' in cards ? cards.player.length : cards.infection.length);
	// Player cards stand upright and Infection cards lie on their side, so a pile of them takes fewer to a row.
	const fitted = $derived(Math.min(9, Math.max(3, Math.ceil(Math.sqrt(count * ('player' in cards ? 1.5 : 0.7))))));
</script>

<!-- A pile laid out as real cards. A seat's whole hand and a tooltip section's cards both open as one. -->
{#if count}
	<div
		class="spread {className}"
		class:beside={beside !== undefined}
		class:right={side === 'right'}
		{@attach beside ? keepOnScreen : undefined}
		style:--cols={Math.max(1, Math.min(cols ?? (beside ? fitted : 3), count))}
		style:--card-size={size}
		role="group"
		aria-label={label}
		data-testid={testid}
		{@attach feedback(undefined, () => ({ label, count }))}
		transition:fly={{ y: from, duration: 180, easing: cubicOut }}
	>
		{#if 'player' in cards}
			{#each cards.player as card (card.id)}<PlayerCard {card} onclick={onselect} />{/each}
		{:else}
			{#each cards.infection as card (card.id)}<InfectionCard {card} onclick={onselect} />{/each}
		{/if}
	</div>
{/if}

<style>
	.spread {
		position: absolute;
		z-index: 10;
		display: grid;
		grid-template-columns: repeat(var(--cols), max-content);
		gap: 0.35rem;
		padding: 0.35rem;
		border-radius: 4px;
		background: rgb(20 12 4 / 0.6);
		box-shadow: var(--slip-shadow);
	}

	.beside {
		top: 0;
		right: calc(100% + 0.5rem);
		max-height: calc(100vh - 5rem);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.beside.right {
		right: auto;
		left: calc(100% + 0.5rem);
	}
</style>
