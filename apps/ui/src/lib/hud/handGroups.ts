import { pack } from '@repo/game';
import type { PlayerCard, PlayerDeckKind } from '@repo/game';
import {
	COMPANION_ICON,
	EPIDEMIC_ICON,
	EVENT_ICON,
	IMPROVEMENT_MARK,
	PRODUCE_ICON,
	SEARCH_ICON,
} from '#lib/cards/icons.ts';
import { regionOf, sortHand } from './handOrder.ts';

export type HandGroup = {
	/** Stable while the group exists, so a card joining or leaving animates within it. */
	key: string;
	cards: PlayerCard[];
	/** Which band it wears: a city's colour, or the card's kind. */
	tone: PlayerDeckKind;
	icon?: string;
	/** A short mark printed instead of an icon, such as an improvement's card value. */
	mark?: string;
	/** What is in the group, card by card, for the tooltip. */
	title: string;
};

/**
 * A hand as the seat card shows it: interchangeable cards stack, and a card that carries its own state or ability
 * stands alone. Plain city cards are interchangeable by colour, since colour is what they pay for building and recon.
 * A city card with an improvement or open search boxes, and every companion, is its own card. Events stack only with the
 * same event in the same mode, and Produce Supplies only with the same boxes left. Groups follow the hand's one order
 * (`sortHand`), each where its first card falls.
 */
export function handGroups(hand: PlayerCard[], name: (card: PlayerCard) => string): HandGroup[] {
	const groups = new Map<string, PlayerCard[]>();
	for (const card of sortHand(hand, name)) {
		const key = keyOf(card);
		groups.set(key, [...(groups.get(key) ?? []), card]);
	}
	return [...groups].map(([key, cards]) => describe(key, cards, name));
}

/** A spent search box leaves nothing to do, so the card is as plain as any other of its colour. */
const openSearches = (card: Extract<PlayerCard, { kind: 'city' }>) => card.search.filter(box => !box.scratched).length;

function keyOf(card: PlayerCard): string {
	switch (card.kind) {
		case 'city':
			return card.improvement || openSearches(card) || card.companion
				? `card:${card.id}`
				: `color:${regionOf(card.city)}`;
		case 'event':
			return `event:${card.event}:${card.mode}`;
		case 'produce':
			return `produce:${card.boxesLeft}`;
		case 'epidemic':
			return 'epidemic';
	}
}

function describe(key: string, cards: PlayerCard[], name: (card: PlayerCard) => string): HandGroup {
	const card = cards[0]!;
	const listed = tally(cards.map(name));
	switch (card.kind) {
		case 'city': {
			const region = regionOf(card.city);
			const open = openSearches(card);
			if (cards.length === 1 && (card.improvement || open || card.companion)) {
				const improvement = pack.cityImprovements.find(item => item.id === card.improvement);
				const companion = pack.companions.find(item => item.id === card.companion);
				const mark = card.improvement ? IMPROVEMENT_MARK[card.improvement] : undefined;
				const extras = [
					improvement && `${improvement.name}: ${improvement.text}`,
					companion && `${companion.name}: ${companion.text}`,
					open && `${open} search box${open === 1 ? '' : 'es'}`,
				].filter(Boolean);
				return {
					key,
					cards,
					tone: region,
					icon: mark?.icon ?? (mark ? undefined : card.companion ? COMPANION_ICON[card.companion] : SEARCH_ICON),
					mark: mark?.text,
					title: `${name(card)} (${extras.join('; ')})`,
				};
			}
			const what = region === 'haven' ? 'haven' : `${region} city`;
			return {
				key,
				cards,
				tone: region,
				title: `${cards.length} ${what} card${cards.length === 1 ? '' : 's'}: ${listed}`,
			};
		}
		case 'event': {
			const event = pack.events.find(item => item.id === card.event)!;
			const mode = card.mode === 'unrationed' ? ', one use' : '';
			return {
				key,
				cards,
				tone: 'event',
				icon: EVENT_ICON[card.event],
				title: `${listed} (event${mode}): ${event.text}`,
			};
		}
		case 'produce':
			return {
				key,
				cards,
				tone: 'produce',
				icon: PRODUCE_ICON,
				title: `${listed} (${card.boxesLeft} ${card.boxesLeft === 1 ? 'use' : 'uses'} left)`,
			};
		case 'epidemic':
			return { key, cards, tone: 'epidemic', icon: EPIDEMIC_ICON, title: listed };
	}
}

/** Names in hand order, a repeated name once with its count: "Washington ×2, New York". */
function tally(names: string[]): string {
	const counts = new Map<string, number>();
	for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
	return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ');
}
