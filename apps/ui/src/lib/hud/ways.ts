import { isFreeAction } from '@repo/game';
import type { Action, CardId, World } from '@repo/game';

/** What a card is, apart from which copy it is: two cards that read the same are one choice. */
export function cardTwin(world: World, id: CardId): string {
	const card = world.campaign.playerCards[id];
	if (!card) return id;
	if (card.kind === 'city')
		return `${card.city}/${card.improvement}/${card.companion}/${card.search.map(box => Number(box.scratched)).join('')}`;
	if (card.kind === 'produce') return `produce/${card.boxesLeft}`;
	return card.kind === 'event' ? `${card.event}/${card.mode}` : id;
}

/**
 * The ways a click offers to take an action. A free action that moves an amount moves one at a time: a second
 * click takes the next, and undo puts one back, so asking how many is a step nobody needs. Deliver does the same,
 * since the deliveries after the first to one place ride on its action. Ways that differ only in which of two
 * identical cards they spend are one way.
 */
export function ways(world: World, variants: Action[]): Action[] {
	const first = variants[0];
	// Carry is once per turn, so it asks how many.
	const stepped =
		!first || (!isFreeAction(first.a) && first.a !== 'deliver') || first.a === 'carry'
			? variants
			: variants.filter(action => !('count' in action) || action.count === 1);
	const seen = new Set<string>();
	return stepped.filter(action => {
		const spent = action as { card?: CardId; cards?: CardId[]; discard?: CardId[] };
		const key = JSON.stringify({
			...action,
			...(spent.card ? { card: cardTwin(world, spent.card) } : {}),
			...(spent.cards ? { cards: spent.cards.map(id => cardTwin(world, id)).toSorted() } : {}),
			...(spent.discard ? { discard: spent.discard.map(id => cardTwin(world, id)).toSorted() } : {}),
		});
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
