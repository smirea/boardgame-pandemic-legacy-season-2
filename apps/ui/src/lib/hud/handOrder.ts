import { cityDef } from '@repo/game';
import type { CityId, Color, InfectionCard, PlayerCard } from '@repo/game';

const COLOR_ORDER: (Color | 'haven')[] = ['blue', 'yellow', 'black', 'red', 'haven'];
const KIND_ORDER: PlayerCard['kind'][] = ['city', 'event', 'produce', 'epidemic'];

export const regionOf = (city: CityId) => cityDef(city).color ?? 'haven';

const rank = (card: PlayerCard) =>
	KIND_ORDER.indexOf(card.kind) * 10 + (card.kind === 'city' ? COLOR_ORDER.indexOf(regionOf(card.city)) : 0);

/**
 * The one order a hand is shown in, wherever it is shown: city cards by colour, then by name, then events, Produce
 * Supplies, companions and epidemics. The card id breaks ties so two copies never swap places between renders.
 */
export function sortHand(hand: PlayerCard[], name: (card: PlayerCard) => string): PlayerCard[] {
	return hand
		.map(card => ({ card, rank: rank(card), name: name(card) }))
		.toSorted((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.card.id.localeCompare(b.card.id))
		.map(entry => entry.card);
}

const infectionRank = (card: InfectionCard) =>
	card.kind === 'city'
		? COLOR_ORDER.indexOf(regionOf(card.city))
		: COLOR_ORDER.length + (card.kind === 'gather' ? 0 : 1);

/** Infection cards in the same order as a hand: cities by colour then name, then the Hollow Men cards. */
export function sortInfection(cards: InfectionCard[], name: (card: InfectionCard) => string): InfectionCard[] {
	return cards
		.map(card => ({ card, rank: infectionRank(card), name: name(card) }))
		.toSorted((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.card.id.localeCompare(b.card.id))
		.map(entry => entry.card);
}
