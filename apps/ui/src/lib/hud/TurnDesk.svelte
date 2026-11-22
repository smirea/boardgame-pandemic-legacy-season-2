<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { flip } from 'svelte/animate';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import { inkOn } from '#lib/color.ts';
	import type { DrawnInfection } from './infectionShow.svelte.ts';

	type Props = {
		/** The side column it stands in, so the deck keeps to the screen's edge and cards are shown inward of it. */
		side: 'left' | 'right';
		/** The deck that is out: the Player deck while cards are drawn, then the Infection deck. */
		deck: 'player' | 'infection';
		count: number;
		/** How many more cards this step takes. */
		left: number;
		/** A click on the deck, when this browser's player is the one to take the next card. */
		action: { busy: boolean; onclick: () => void } | null;
		/** Whose turn it is, shown to everyone, or null while the whole table flips the cards that open a game. */
		name: string | null;
		color: string;
		/** An Epidemic lies beside the deck and nothing else is drawn until it is started. */
		epidemic: boolean;
		/** The Infection cards flipped in this step, newest first. */
		stack: DrawnInfection[];
	};

	let { side, deck, count, left, action, name, color, epidemic, stack }: Props = $props();

	const ready = $derived(action !== null && !action.busy);
	const badge = $derived(
		epidemic
			? 'Epidemic drawn'
			: left === 0
				? deck === 'player'
					? 'Cards drawn'
					: 'Cities infected'
				: action
					? `${deck === 'player' ? 'Draw' : 'Flip'} · ${left} left`
					: `${left} to ${deck === 'player' ? 'draw' : 'flip'}`,
	);
	const away = $derived(side === 'left' ? -1 : 1);

	/** A flipped Infection card leaves the deck small and face down, and turns up as it lands in its place. */
	function fromDeck(node: HTMLElement) {
		const pile = node.closest('.desk')?.querySelector('[data-turn-deck]')?.getBoundingClientRect();
		const card = node.getBoundingClientRect();
		const dx = pile ? pile.left + pile.width / 2 - (card.left + card.width / 2) : 0;
		const dy = pile ? pile.top + pile.height / 2 - (card.top + card.height / 2) : 0;
		return {
			duration: 520,
			easing: cubicOut,
			css: (t: number) =>
				`transform: translate(${dx * (1 - t)}px, ${dy * (1 - t)}px) scale(${0.3 + 0.7 * t}) rotateY(${(1 - t) * 180}deg); opacity: ${Math.min(1, t * 3)}`,
		};
	}

	function leave(_node: HTMLElement) {
		return {
			duration: 280,
			easing: cubicIn,
			css: (t: number) => `transform: translateY(${(1 - t) * -18}px) scale(${0.9 + t * 0.1}); opacity: ${t}`,
		};
	}
</script>

<!--
	Where the turn is wound up, in the place the Actions panel stood: the deck the next card comes from, and beside it
	the card just turned. Everyone at the table sees it; only the player whose turn it is can click the deck.
-->
<section
	class="desk {side}"
	style:--seat={color}
	style:--on={inkOn(color)}
	aria-label={name === null
		? 'Opening infection: flip Infection cards'
		: `${name}'s turn: ${deck === 'player' ? 'draw Player cards' : 'flip Infection cards'}`}
	data-testid="turn-desk"
	data-deck={deck}
	{@attach feedback('Turn desk', () => ({ deck, left, count, epidemic, mine: action !== null, flipped: stack.length }))}
>
	<div class="well">
		{#key deck}
			<button
				class="deck {deck}"
				class:ready
				disabled={!ready}
				onclick={() => ready && action!.onclick()}
				data-turn-deck
				data-testid={deck === 'player' ? 'player-draw-deck' : 'infection-draw-deck'}
				aria-label={deck === 'player'
					? `Draw from the Player deck (${left} left)`
					: `Flip an Infection card (${left} left)`}
				title={ready ? 'Space' : undefined}
				in:fly={{ x: away * 160, duration: 380, delay: 220 }}
				out:fly={{ x: away * 160, duration: 240 }}
			>
				<span class="pile">
					{#if deck === 'player'}
						<span class="emblem" aria-hidden="true">✦</span>
					{:else}
						<svg class="emblem" viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="12" cy="12" r="2.2" fill="currentColor" />
							<path
								d="M12 4.2a4.3 4.3 0 0 0-3.7 6.5l1.5-.9a2.6 2.6 0 1 1 4.4 0l1.5.9A4.3 4.3 0 0 0 12 4.2Zm-6.8 11.7a4.3 4.3 0 0 0 7.4-.1l-1.5-.9a2.6 2.6 0 1 1-2.2-3.8V9.4a4.3 4.3 0 0 0-3.7 6.5Zm13.6 0a4.3 4.3 0 0 0-3.7-6.5v1.7a2.6 2.6 0 1 1-2.2 3.8l-1.5.9a4.3 4.3 0 0 0 7.4.1Z"
								fill="currentColor"
							/>
						</svg>
					{/if}
					<span class="label">{deck === 'player' ? 'Player' : 'Infection'}</span>
					<strong class="count">{count}</strong>
				</span>
			</button>
		{/key}
		<span class="who"><i></i>{name ?? 'Everyone'}</span>
		<span class="badge" class:alarm={epidemic} data-testid="turn-desk-badge">{badge}</span>
	</div>
	<!-- A drawn Player card is laid over this by `CardFlights`, which finds it by its mark. -->
	<div class="slot" data-turn-slot data-testid="infection-draw">
		{#each stack as entry, index (entry.key)}
			<div class="layer" class:older={index > 0} animate:flip={{ duration: 320 }} in:fromDeck out:leave>
				<InfectionCard card={entry.card} note={entry.note} alarm={entry.alarm} />
			</div>
		{/each}
	</div>
</section>

<style>
	.desk {
		display: flex;
		align-items: flex-end;
		gap: 0.7rem;
		width: max-content;
		pointer-events: none;
	}

	.desk.right {
		flex-direction: row-reverse;
	}

	/* Both decks stand in the one place: as the Player deck leaves, the Infection deck comes in over it. */
	.well {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		pointer-events: auto;
	}

	.deck {
		grid-area: 1 / 1;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		cursor: default;
	}

	.pile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		width: 5.6rem;
		height: 7.6rem;
		padding: 0.7rem 0.4rem 0.55rem;
		border: 2px solid rgb(244 232 205 / 0.55);
		border-radius: 0.5rem;
		background:
			radial-gradient(circle at 50% 38%, rgb(255 244 214 / 0.14), transparent 62%),
			repeating-linear-gradient(135deg, #5d5446 0 0.4rem, #544b3e 0.4rem 0.8rem);
		color: #f4e8cd;
		/* The cards under the top one, as a pile shows its edge. */
		box-shadow:
			0.18rem 0.18rem 0 #3f382e,
			0.36rem 0.36rem 0 #2f2a23,
			0 0.9rem 1.8rem rgb(0 0 0 / 0.5);
		transition:
			transform 180ms ease,
			box-shadow 180ms ease;
	}

	.infection .pile {
		border-color: rgb(147 178 54 / 0.7);
		background:
			radial-gradient(circle at 50% 38%, rgb(147 178 54 / 0.2), transparent 62%),
			repeating-linear-gradient(135deg, #2c2733 0 0.4rem, #262130 0.4rem 0.8rem);
		color: #cfe38a;
		box-shadow:
			0.18rem 0.18rem 0 #1d1922,
			0.36rem 0.36rem 0 #141118,
			0 0.9rem 1.8rem rgb(0 0 0 / 0.5);
	}

	.emblem {
		width: 2.2rem;
		height: 2.2rem;
		font-size: 2rem;
		line-height: 2.2rem;
		text-align: center;
	}

	.label {
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.count {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		line-height: 1;
	}

	.deck.ready {
		cursor: pointer;
	}

	/* A few beats and then still: a pulse that never ends keeps the whole page drawing (see AGENTS.md). */
	.deck.ready .pile {
		animation: beckon 1.5s ease-in-out 6;
		box-shadow:
			0.18rem 0.18rem 0 #3f382e,
			0.36rem 0.36rem 0 #2f2a23,
			0 0 0 0.16rem rgb(227 178 60 / 0.75),
			0 0.9rem 1.8rem rgb(0 0 0 / 0.5);
	}

	.deck.infection.ready .pile {
		box-shadow:
			0.18rem 0.18rem 0 #1d1922,
			0.36rem 0.36rem 0 #141118,
			0 0 0 0.16rem rgb(147 178 54 / 0.8),
			0 0.9rem 1.8rem rgb(0 0 0 / 0.5);
	}

	.deck.ready:hover .pile,
	.deck.ready:focus-visible .pile {
		transform: translateY(-0.25rem) scale(1.04);
	}

	@keyframes beckon {
		0%,
		100% {
			transform: none;
		}
		50% {
			transform: translateY(-0.2rem) scale(1.05);
		}
	}

	.who {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.1rem 0.5rem;
		border-radius: 2px;
		background: var(--seat);
		color: var(--on);
		font-size: 0.78rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.who i {
		flex: none;
		width: 0.4rem;
		height: 0.4rem;
		border: 2px solid currentColor;
		border-radius: 50%;
	}

	.badge {
		padding: 0.18rem 0.55rem;
		border-radius: 2px;
		background: rgb(20 16 12 / 0.9);
		color: var(--paper);
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
		box-shadow: 0 0.4rem 1rem rgb(0 0 0 / 0.45);
	}

	.badge.alarm {
		background: #a8261c;
		color: #fff3e6;
	}

	/* The newest card stands whole at the foot, level with the deck. Each one before it shows the strip with its name. */
	.slot {
		position: relative;
		display: flex;
		flex-direction: column-reverse;
		gap: 0.2rem;
		width: 9.6rem;
		min-height: 9.4rem;
		--card-size: 0.86rem;
		perspective: 40rem;
	}

	.desk.right .slot {
		align-items: flex-end;
	}

	.layer {
		display: flex;
		flex: none;
		align-items: flex-end;
		max-height: 9.2em;
		border-radius: 0.35em;
		font-size: var(--card-size);
		overflow: hidden;
		pointer-events: auto;
		transition: max-height 320ms cubic-bezier(0.3, 0, 0.2, 1);
	}

	.layer.older {
		max-height: 2.75em;
	}

	.layer.older:hover {
		max-height: 9.2em;
	}
</style>
