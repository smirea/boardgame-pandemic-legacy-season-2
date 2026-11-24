<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Character, SeatId } from '@repo/game';
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { characterVoice } from '#lib/characters/voice.svelte.ts';
	import { inkOn } from '#lib/color.ts';
	import CharacterSheet from './characters/CharacterSheet.svelte';

	type Props = {
		name: string;
		color: string;
		seat: SeatId;
		/** The character who plays next, or none for a seat without one. */
		character: Character | null;
		/** True when the character starts their turn in a city with Plague or Hollow Men. */
		danger?: boolean;
		/** This browser plays the seat, so the panel speaks to its player. */
		mine: boolean;
		/** Called once the card is back in its seat, or when something else takes the table before it gets there. */
		ondone: () => void;
	};

	let { name, color, seat, character, danger = false, mine, ondone }: Props = $props();

	const HOLD_MS = 1300;
	const GROW = { duration: 300, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.04)' };
	const SHRINK = { duration: 220, easing: 'cubic-bezier(0.5, 0, 0.8, 0.4)' };

	// The card grows out of the seat's character and goes back into it, so the table sees whose turn it is and where
	// that player sits.
	const seatOf = () => document.querySelector<HTMLElement>(`.place[data-seat="${seat}"] .slip`);
	const side = $derived(document.querySelector(`.place[data-seat="${seat}"]`)?.matches('.tr, .br') ? 'right' : 'left');
	const morph = (card: HTMLElement) => {
		const from = seatOf()?.getBoundingClientRect();
		const to = card.getBoundingClientRect();
		if (!from || !to.width) return null;
		const x = from.left + from.width / 2 - (to.left + to.width / 2);
		const y = from.top + from.height / 2 - (to.top + to.height / 2);
		return `translate(${x}px, ${y}px) scale(${from.width / to.width})`;
	};

	let shown = $state(true);
	// Untracked: the attachment runs once per turn announced. Run again by a change to what it read, it would say
	// the line twice, and while the table moves on under it those props go away and their getters throw.
	const grow = (card: HTMLElement) => untrack(() => play(card));
	function play(card: HTMLElement) {
		let live = true;
		if (character) {
			characterVoice.playFor(character, danger ? 'danger' : 'punchline', { priority: 'game', interrupt: true });
		}
		const away = morph(card);
		card.animate(
			away
				? [
						{ transform: away, opacity: 0.4 },
						{ transform: 'none', opacity: 1 },
					]
				: [{ opacity: 0 }, { opacity: 1 }],
			{ ...GROW, fill: 'backwards' },
		);
		// Read now: by the time the card is put away, the turn it announced may no longer be the one to announce.
		const finished = ondone;
		const done = () => {
			if (!live) return;
			live = false;
			finished();
		};
		const timer = setTimeout(() => {
			if (!live) return;
			shown = false;
			const back = morph(card) ?? away;
			const frames = back
				? [
						{ transform: 'none', opacity: 1 },
						{ transform: back, opacity: 0.4 },
					]
				: [{ opacity: 1 }, { opacity: 0 }];
			card.animate(frames, { ...SHRINK, fill: 'forwards' }).onfinish = done;
		}, GROW.duration + HOLD_MS);
		return () => {
			clearTimeout(timer);
			// An interlude cut short by what the turn's first move set off has still been shown: it does not play again.
			// Said once the card is gone. Saying it here would change what the card is drawn from while it is taken down.
			queueMicrotask(done);
		};
	}
</script>

<!-- The whole table stops for a moment between turns to say who is up. It takes no clicks. -->
<div
	class="interlude"
	class:shown
	style:--seat={color}
	style:--on={inkOn(color)}
	role="status"
	data-testid="turn-interlude"
	transition:fade={{ duration: 200 }}
	{@attach feedback('Next turn', () => ({ name, seat, mine }))}
>
	<div class="card" {@attach grow}>
		<span class="kicker">{mine ? 'Your turn' : `${name}'s turn`}</span>
		{#if character}
			<CharacterSheet {character} tone="mine" {color} {side} label="Next turn card" />
		{:else}
			<strong>{name}</strong>
		{/if}
	</div>
</div>

<style>
	.interlude {
		position: absolute;
		inset: 0;
		z-index: 46;
		display: grid;
		place-items: center;
		background: radial-gradient(
			ellipse at 50% 46%,
			color-mix(in srgb, var(--seat) 26%, rgb(12 9 6 / 0.55)),
			rgb(10 8 6 / 0.78)
		);
		pointer-events: none;
		transition: background 200ms ease;
	}

	.interlude:not(.shown) {
		background: transparent;
	}

	.card {
		position: relative;
		width: min(44rem, 62vw, calc(72vh * 1.2));
		aspect-ratio: 1.2;
		transform-origin: center;
	}

	.kicker {
		position: absolute;
		bottom: 100%;
		left: 50%;
		z-index: 4;
		padding: 0.12rem 0.8rem;
		translate: -50% -0.4rem;
		border-radius: 2px;
		background: var(--seat);
		color: var(--on);
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.card > strong {
		display: grid;
		place-items: center;
		height: 100%;
		color: #f6ebd4;
		font-family: var(--font-display);
		font-size: 3.4rem;
		font-weight: 400;
	}
</style>
