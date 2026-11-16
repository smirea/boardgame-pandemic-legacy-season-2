import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/** The top bar marks the Player deck with this, so a drawn card can be seen leaving it. */
export const DECK = '[data-deck="player"]';

/**
 * Brings a card into a hand. A card just drawn travels from the Player deck to its place, turning face up as
 * it lands. Any other card, such as one handed over, settles in where it lands. The card is measured at its
 * final place, so the hand around it can slide aside at the same time without the card jumping.
 */
export function deal(node: Element, { drawn, delay = 0 }: { drawn: boolean; delay?: number }): TransitionConfig {
	const deck = drawn ? document.querySelector(DECK) : null;
	if (!deck) {
		return {
			delay,
			duration: 320,
			easing: cubicOut,
			css: (t, u) => `opacity: ${t}; transform: translateY(${u * 0.6}rem) scale(${0.94 + 0.06 * t})`,
		};
	}
	const from = deck.getBoundingClientRect();
	const to = node.getBoundingClientRect();
	const dx = from.left + from.width / 2 - (to.left + to.width / 2);
	const dy = from.top + from.height / 2 - (to.top + to.height / 2);
	const start = Math.min(1, Math.max(0.2, from.height / Math.max(1, to.height)));
	const distance = Math.hypot(dx, dy);
	return {
		delay,
		duration: Math.min(900, 420 + distance * 0.6),
		easing: cubicOut,
		css: (t, u) => {
			// A low arc rather than a straight line, so the card is seen to travel and not to slide.
			const lift = Math.sin(Math.PI * t) * Math.min(80, distance * 0.15);
			return [
				`transform: translate(${dx * u}px, ${dy * u - lift}px) rotate(${u * -14}deg) scale(${start + (1 - start) * t})`,
				`opacity: ${Math.min(1, t * 4)}`,
				'z-index: 60',
			].join(';');
		},
	};
}
