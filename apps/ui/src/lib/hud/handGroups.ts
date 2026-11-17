import { cityDef, pack } from '@repo/game';
import type { CityId, Color, PlayerCard, PlayerDeckKind } from '@repo/game';
import {
	COMPANION_ICON,
	EPIDEMIC_ICON,
	EVENT_ICON,
	IMPROVEMENT_MARK,
	PRODUCE_ICON,
	SEARCH_ICON,
} from '#lib/cards/icons.ts';

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

const COLOR_ORDER: (Color | 'haven')[] = ['blue', 'yellow', 'black', 'red', 'haven'];
const KIND_ORDER: PlayerCard['kind'][] = ['city', 'produce', 'event', 'companion', 'epidemic'];

const regionOf = (city: CityId) => cityDef(city).color ?? 'haven';

/**
 * A hand as the seat card shows it: interchangeable cards stack, and a card that carries its own state or ability
 * stands alone. Plain city cards are interchangeable by colour, since colour is what they pay for building and recon.
 * A city card with an improvement or search boxes, and every companion, is its own card. Events stack only with the
 * same event in the same mode, and Produce Supplies only with the same boxes left.
 */
export function handGroups(hand: PlayerCard[], name: (card: PlayerCard) => string): HandGroup[] {
	const groups = new Map<string, PlayerCard[]>();
	for (const card of hand) {
		const key = keyOf(card);
		groups.set(key, [...(groups.get(key) ?? []), card]);
	}
	return [...groups]
		.map(([key, cards]) => describe(key, cards, name))
		.sort((a, b) => rank(a.cards[0]!) - rank(b.cards[0]!) || a.key.localeCompare(b.key));
}

function keyOf(card: PlayerCard): string {
	switch (card.kind) {
		case 'city':
			return card.improvement || card.search.length ? `card:${card.id}` : `color:${regionOf(card.city)}`;
		case 'event':
			return `event:${card.event}:${card.mode}`;
		case 'produce':
			return `produce:${card.boxesLeft}`;
		case 'companion':
			return `card:${card.id}`;
		case 'epidemic':
			return 'epidemic';
	}
}

function rank(card: PlayerCard): number {
	const kind = KIND_ORDER.indexOf(card.kind) * 100;
	if (card.kind !== 'city') return kind;
	const unique = card.improvement || card.search.length ? 1 : 0;
	return kind + COLOR_ORDER.indexOf(regionOf(card.city)) * 2 + unique;
}

function describe(key: string, cards: PlayerCard[], name: (card: PlayerCard) => string): HandGroup {
	const card = cards[0]!;
	const listed = tally(cards.map(name));
	switch (card.kind) {
		case 'city': {
			const region = regionOf(card.city);
			if (cards.length === 1 && (card.improvement || card.search.length)) {
				const improvement = pack.cityImprovements.find(item => item.id === card.improvement);
				const mark = card.improvement ? IMPROVEMENT_MARK[card.improvement] : undefined;
				const extras = [
					improvement && `${improvement.name}: ${improvement.text}`,
					card.search.length && `${card.search.length} search box${card.search.length === 1 ? '' : 'es'}`,
				].filter(Boolean);
				return {
					key,
					cards,
					tone: region,
					icon: mark?.icon ?? (mark ? undefined : SEARCH_ICON),
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
		case 'companion': {
			const companion = pack.companions.find(item => item.id === card.companion)!;
			return {
				key,
				cards,
				tone: 'companion',
				icon: COMPANION_ICON[card.companion],
				title: `${listed} (companion): ${companion.text}`,
			};
		}
		case 'produce':
			return {
				key,
				cards,
				tone: 'produce',
				icon: PRODUCE_ICON,
				title: `${listed} (${card.boxesLeft} system-wide left)`,
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
