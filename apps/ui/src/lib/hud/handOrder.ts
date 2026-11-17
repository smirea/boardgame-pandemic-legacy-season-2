import { cityDef } from '@repo/game';
import type { CityId, Color, PlayerCard } from '@repo/game';

const COLOR_ORDER: (Color | 'haven')[] = ['blue', 'yellow', 'black', 'red', 'haven'];
const KIND_ORDER: PlayerCard['kind'][] = ['city', 'event', 'produce', 'companion', 'epidemic'];

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
